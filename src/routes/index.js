const express = require('express')
const crypto = require('crypto')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { projectPath } = require('../../config')
const API_HOST = express()
API_HOST.use(cors()) // 👈 NHẬN TẤT CẢ ORIGIN

/** Nano desktop sign-in: app registers token, browser POSTs /listen, renderer polls. */
const SIGNIN_PENDING_TTL_MS = 15 * 60 * 1000
const SIGNIN_RESULT_TTL_MS = 2 * 60 * 1000
const pendingNanoSignIn = new Map() // token -> expireAt (number)
const completedNanoSignIn = new Map() // token -> { access_token, expireAt }

function cleanupNanoSignInMaps() {
    const now = Date.now()
    for (const t of [...pendingNanoSignIn.keys()]) {
        const exp = pendingNanoSignIn.get(t)
        if (exp == null || exp < now) pendingNanoSignIn.delete(t)
    }
    for (const t of [...completedNanoSignIn.keys()]) {
        const row = completedNanoSignIn.get(t)
        if (!row || row.expireAt < now) completedNanoSignIn.delete(t)
    }
}

const STORAGE_PATH = path.join(projectPath, 'metadata', 'resources')

// JSON (base64 asset) — tăng hạn mặc định; file lớn nên dùng POST .../assets/upload (multipart)
const bodyParser = require('body-parser');
API_HOST.use(bodyParser.json({ limit: '500mb' }));
API_HOST.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// Services
const project = require('../services/project.service')
const storyboard = require('../services/storyboard.service')
const metaService = require('../services/meta.service')
const renderService = require('../services/render.service')

const STORYBOARD_STORAGE_PATH = path.join(projectPath, 'metadata', 'storyboards')
// Project services
API_HOST.get('/api/projects', project.list.bind(project));
API_HOST.post('/api/projects/create', project.create.bind(project));
API_HOST.put('/api/projects/:id', project.update.bind(project));    // Thêm route này để lưu Flow
API_HOST.get('/api/projects/:id/timeline', project.getTimeline.bind(project));
API_HOST.put('/api/projects/:id/timeline', project.saveTimeline.bind(project));
API_HOST.delete('/api/projects/:id', project.delete.bind(project)); // Thêm route này để xóa Project
API_HOST.post('/api/projects/:id/assets', project.saveAsset.bind(project));

const assetUploadStorage = multer.diskStorage({
    destination(req, file, cb) {
        const id = req.params.id
        const dir = path.join(STORAGE_PATH, id, 'assets')
        try {
            fs.mkdirSync(dir, { recursive: true })
            cb(null, dir)
        } catch (e) {
            cb(e)
        }
    },
    filename(req, file, cb) {
        const nodeId = String(req.body?.nodeId || 'node').replace(/[^a-zA-Z0-9-_]/g, '_')
        const kind = String(req.body?.kind || 'asset').replace(/[^a-zA-Z0-9-_]/g, '_')
        const rawExt = path.extname(file.originalname || '')
        const ext = rawExt && rawExt.length <= 10 ? rawExt.toLowerCase() : '.bin'
        const hash = crypto.randomBytes(8).toString('hex')
        cb(null, `${nodeId}-${kind}-${Date.now()}-${hash}${ext}`)
    }
})
const assetUpload = multer({
    storage: assetUploadStorage,
    limits: { fileSize: 512 * 1024 * 1024 }
})

API_HOST.post('/api/projects/:id/assets/upload', (req, res) => {
    assetUpload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, message: 'File quá lớn (tối đa 512MB).' })
            }
            return res.status(400).json({ success: false, message: err.message || 'Upload lỗi' })
        }
        project.saveAssetUpload(req, res)
    })
})

// Storyboard projects
API_HOST.get('/api/storyboards', storyboard.list.bind(storyboard));
API_HOST.get('/api/storyboards/:id', storyboard.getOne.bind(storyboard));
API_HOST.post('/api/storyboards/create', storyboard.create.bind(storyboard));
API_HOST.put('/api/storyboards/:id', storyboard.update.bind(storyboard));
API_HOST.get('/api/storyboards/:id/timeline', storyboard.getTimeline.bind(storyboard));
API_HOST.put('/api/storyboards/:id/timeline', storyboard.saveTimeline.bind(storyboard));
API_HOST.delete('/api/storyboards/:id', storyboard.delete.bind(storyboard));
API_HOST.post('/api/storyboards/:id/assets', storyboard.saveAsset.bind(storyboard));

const storyboardUploadStorage = multer.diskStorage({
    destination(req, file, cb) {
        const id = req.params.id
        const dir = path.join(STORYBOARD_STORAGE_PATH, id, 'assets')
        try {
            fs.mkdirSync(dir, { recursive: true })
            cb(null, dir)
        } catch (e) {
            cb(e)
        }
    },
    filename(req, file, cb) {
        const kind = String(req.body?.kind || 'upload').replace(/[^a-zA-Z0-9-_]/g, '_')
        const rawExt = path.extname(file.originalname || '')
        const ext = rawExt && rawExt.length <= 10 ? rawExt.toLowerCase() : '.bin'
        const hash = crypto.randomBytes(8).toString('hex')
        cb(null, `${kind}-${Date.now()}-${hash}${ext}`)
    }
})
const storyboardUpload = multer({
    storage: storyboardUploadStorage,
    limits: { fileSize: 512 * 1024 * 1024 }
})

API_HOST.post('/api/storyboards/:id/assets/upload', (req, res) => {
    storyboardUpload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, message: 'File quá lớn (tối đa 512MB).' })
            }
            return res.status(400).json({ success: false, message: err.message || 'Upload lỗi' })
        }
        storyboard.saveAssetUpload(req, res)
    })
})

/** Đăng ký session token trước khi mở trình duyệt (chỉ chấp nhận /listen cho token đã đăng ký). */
API_HOST.post('/api/auth/signin-register', (req, res) => {
    try {
        cleanupNanoSignInMaps()
        const token = String(req.body?.token || '').trim()
        if (!token || token.length < 16) {
            return res.status(400).json({ success: false, message: 'token required (min 16 chars)' })
        }
        pendingNanoSignIn.set(token, Date.now() + SIGNIN_PENDING_TTL_MS)
        return res.status(200).json({ success: true })
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message })
    }
})

/**
 * Website gọi sau khi user đăng nhập Nano AI.
 * Body: { token: string, data: { access_token: string } }
 */
API_HOST.post('/listen', (req, res) => {
    try {
        cleanupNanoSignInMaps()
        const token = String(req.body?.token || '').trim()
        const accessToken = String(req.body?.data?.access_token ?? '').trim()
        if (!token) {
            return res.status(400).json({ success: false, message: 'token is required' })
        }
        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'data.access_token is required' })
        }
        if (!pendingNanoSignIn.has(token)) {
            return res.status(404).json({ success: false, message: 'Unknown or expired session token' })
        }
        const exp = pendingNanoSignIn.get(token)
        if (exp < Date.now()) {
            pendingNanoSignIn.delete(token)
            return res.status(410).json({ success: false, message: 'Session expired' })
        }
        pendingNanoSignIn.delete(token)
        completedNanoSignIn.set(token, {
            access_token: accessToken,
            expireAt: Date.now() + SIGNIN_RESULT_TTL_MS
        })
        return res.status(200).json({ success: true })
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message })
    }
})

/** Renderer poll sau khi đã mở trình duyệt; trả access_token một lần rồi xóa. */
/** Hủy session đăng ký (user quay lại màn hình chọn). */
API_HOST.post('/api/auth/signin-abandon', (req, res) => {
    try {
        const token = String(req.body?.token || '').trim()
        if (token) {
            pendingNanoSignIn.delete(token)
            completedNanoSignIn.delete(token)
        }
        return res.status(200).json({ success: true })
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message })
    }
})

API_HOST.get('/api/auth/signin-poll', (req, res) => {
    try {
        cleanupNanoSignInMaps()
        const token = String(req.query.token || '').trim()
        if (!token) {
            return res.status(400).json({ success: false, message: 'token query required' })
        }
        const row = completedNanoSignIn.get(token)
        if (!row) {
            return res.status(200).json({ success: false, pending: true })
        }
        completedNanoSignIn.delete(token)
        return res.status(200).json({
            success: true,
            data: { access_token: row.access_token }
        })
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message })
    }
})

API_HOST.get('/api/workflow/stores', (req, res) => {
    try {
        const storesPath = path.join(projectPath, 'metadata', 'workflow', 'stores.json')
        if (!fs.existsSync(storesPath)) {
            return res.status(200).json({ success: true, data: [] })
        }
        const raw = fs.readFileSync(storesPath, 'utf-8')
        const parsed = JSON.parse(raw)
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : [])
        res.status(200).json({ success: true, data: list })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})


// Meta data

API_HOST.get('/api/meta', metaService.create)
API_HOST.post('/api/meta/upload-video-from-asset', metaService.uploadVideoFromAsset.bind(metaService))
API_HOST.post('/api/meta/media-duration', metaService.mediaDuration.bind(metaService))
API_HOST.post('/api/render', renderService.render.bind(renderService))
API_HOST.post('/api/render/start', renderService.startRender.bind(renderService))
API_HOST.get('/api/render/jobs/:jobId', renderService.getRenderJob.bind(renderService))
API_HOST.post('/api/render/jobs/:jobId/cancel', renderService.cancelRenderJob.bind(renderService))
API_HOST.use('/resources', express.static(path.join(require('../../config').projectPath, 'metadata', 'resources')))
API_HOST.use('/storyboards', express.static(path.join(require('../../config').projectPath, 'metadata', 'storyboards')))
API_HOST.use('/renders', express.static(path.join(require('../../config').projectPath, 'metadata', 'renders')))

// (req, res) => {
// }
module.exports = API_HOST