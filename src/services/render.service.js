const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const { projectPath } = require('../../config');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

const RENDER_DIR = path.join(projectPath, 'metadata', 'renders');
if (!fs.existsSync(RENDER_DIR)) {
    fs.mkdirSync(RENDER_DIR, { recursive: true });
}

const normalizeBinaryPath = (binPath = '') => String(binPath || '').replace('app.asar', 'app.asar.unpacked');
const FFMPEG_PATH = normalizeBinaryPath(ffmpegStatic || '');
const FFPROBE_PATH = normalizeBinaryPath(ffprobeStatic?.path || '');

class RenderService {
    constructor() {
        this.jobs = new Map();
    }
    extensionFromMime(mimeType = '') {
        if (mimeType.includes('png')) return '.png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
        if (mimeType.includes('webp')) return '.webp';
        if (mimeType.includes('gif')) return '.gif';
        if (mimeType.includes('mp4')) return '.mp4';
        if (mimeType.includes('webm')) return '.webm';
        if (mimeType.includes('mp3')) return '.mp3';
        if (mimeType.includes('wav')) return '.wav';
        return '.bin';
    }

    materializeDataUrl(source, tempFiles) {
        const matches = source.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) return null;
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = this.extensionFromMime(mimeType);
        const tempPath = path.join(RENDER_DIR, `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);
        fs.writeFileSync(tempPath, buffer);
        tempFiles.push(tempPath);
        return tempPath;
    }

    resolveToLocalPath(source) {
        if (!source || typeof source !== 'string') return null;
        if (source.startsWith('data:')) return null;
        let rel = source.replace(/\\/g, '/');
        if (rel.startsWith('http://localhost:27123')) rel = rel.replace('http://localhost:27123', '');
        if (rel.startsWith('/resources/')) rel = `metadata${rel}`;
        if (rel.startsWith('resources/')) rel = `metadata/${rel}`;
        if (rel.startsWith('metadata/')) return path.resolve(projectPath, rel);
        return null;
    }

    /** Kích thước khung hình (stream v:0) — dùng tính scale cố định, tránh pad lỗi trên FFmpeg 8. */
    probeVisualStreamDims(absPath, cache) {
        if (!absPath || !cache) return { iw: 1920, ih: 1080 };
        if (cache.has(absPath)) return cache.get(absPath);
        if (!fs.existsSync(absPath)) {
            const f = { iw: 1920, ih: 1080 };
            cache.set(absPath, f);
            return f;
        }
        if (!FFPROBE_PATH) {
            throw new Error('ffprobe binary not found. Please reinstall app dependencies.');
        }
        const r = spawnSync(FFPROBE_PATH, [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=p=0',
            absPath
        ], { encoding: 'utf-8', windowsHide: true, timeout: 30000 });
        let iw = 0;
        let ih = 0;
        if (r.stdout) {
            const first = String(r.stdout).trim().split(/\r?\n/)[0] || '';
            const parts = first.split(',');
            iw = parseInt(parts[0], 10);
            ih = parseInt(parts[1], 10);
        }
        if (!Number.isFinite(iw) || !Number.isFinite(ih) || iw < 1 || ih < 1) {
            iw = 1920;
            ih = 1080;
        }
        const dims = { iw, ih };
        cache.set(absPath, dims);
        return dims;
    }

    /** object-fit:contain trong ô boxW×boxH — pixel chẵn, luôn ow≤boxW, oh≤boxH. */
    containScalePixels(iw, ih, boxW, boxH) {
        const iwN = Math.max(1, Math.floor(iw));
        const ihN = Math.max(1, Math.floor(ih));
        const bw = Math.max(2, Math.floor(boxW));
        const bh = Math.max(2, Math.floor(boxH));
        const s = Math.min(bw / iwN, bh / ihN);
        let ow = Math.floor(iwN * s);
        let oh = Math.floor(ihN * s);
        ow = Math.floor(ow / 2) * 2;
        oh = Math.floor(oh / 2) * 2;
        ow = Math.max(2, Math.min(bw, ow));
        oh = Math.max(2, Math.min(bh, oh));
        while (ow > bw) ow = Math.max(2, ow - 2);
        while (oh > bh) oh = Math.max(2, oh - 2);
        return { ow, oh };
    }

    getRenderTarget(aspectRatio = 'landscape', quality = 'hd') {
        const longSide = quality === '2k' ? 2560 : 1920;
        if (aspectRatio === 'portrait') return { w: Math.round(longSide * 9 / 16), h: longSide };
        if (aspectRatio === 'square') return { w: Math.round(longSide * 9 / 16), h: Math.round(longSide * 9 / 16) };
        return { w: longSide, h: Math.round(longSide * 9 / 16) };
    }

    buildScalePadFilter(aspectRatio, quality) {
        const target = this.getRenderTarget(aspectRatio, quality);
        return `scale=${target.w}:${target.h}:force_original_aspect_ratio=decrease,pad=${target.w}:${target.h}:(ow-iw)/2:(oh-ih)/2`;
    }

    escapeDrawText(input = '') {
        return String(input)
            .replace(/\\/g, '\\\\')
            .replace(/:/g, '\\:')
            .replace(/'/g, "\\'")
            .replace(/%/g, '\\%')
            .replace(/\n/g, '\\n');
    }

    /** FFmpeg drawtext color: 0xRRGGBB or 0xRRGGBBAA */
    ffmpegColor(hex = '#ffffff') {
        let s = String(hex).trim();
        if (!s.startsWith('#')) return '0xffffff';
        s = s.slice(1);
        if (s.length === 3) {
            s = s.split('').map((c) => `${c}${c}`).join('');
        }
        if (s.length === 6 || s.length === 8) return `0x${s}`;
        return '0xffffff';
    }

    /** Giống preview: font-weight cao hơn → cỡ glyph lớn hơn nhẹ; nhân cùng textFontScale. */
    textFontWeightMul(weight) {
        const w = Math.max(100, Math.min(900, Number(weight) || 400));
        return 1 + Math.max(0, w - 400) / 500 * 0.1;
    }

    wrapTextByWidth(input = '', maxCharsPerLine = 24) {
        const normalized = String(input || '').replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        const out = [];
        lines.forEach((line) => {
            const words = line.split(/\s+/).filter(Boolean);
            if (!words.length) {
                out.push('');
                return;
            }
            let current = words[0];
            for (let i = 1; i < words.length; i += 1) {
                const next = words[i];
                if ((current.length + 1 + next.length) <= maxCharsPerLine) {
                    current += ` ${next}`;
                } else {
                    out.push(current);
                    current = next;
                }
            }
            out.push(current);
        });
        return out.join('\n');
    }

    buildRenderPlan(payload = {}) {
        const { timeline = [], aspectRatio = 'landscape', quality = 'hd', previewFrame = null, durationPerImage = 3 } = payload;
        if (!Array.isArray(timeline) || timeline.length === 0) {
            throw new Error('Timeline is empty');
        }

        const num = (v, def) => {
            const x = Number(v);
            return Number.isFinite(x) ? x : def;
        };

        const target = this.getRenderTarget(aspectRatio, quality);
        const previewFrameHeight = Number(previewFrame?.height || 0);
        const textFontScale = previewFrameHeight > 0 ? (target.h / previewFrameHeight) : 1;
        const tempFiles = [];
        const textOverlays = [];
        const visuals = [];
        const pureAudioClips = [];
        const probeCache = new Map();
        let timelineDuration = 0;

        timeline.forEach((item) => {
            const clipDuration = Number(item.duration || durationPerImage || 3);
            const timelineStart = Number(item.timelineStart || 0);
            timelineDuration = Math.max(timelineDuration, timelineStart + clipDuration);

            if (item.type === 'text') {
                const textStyle = item.textStyle || (item.box !== false ? 'fill' : 'plain');
                const fw = Math.max(100, Math.min(900, Number(item.fontWeight) || 400));
                const wMul = this.textFontWeightMul(fw);
                const fontSize = Math.max(4, Math.round(Number(item.fontSize || 40) * textFontScale * wMul));
                textOverlays.push({
                    text: item.text || 'Text',
                    textStyle,
                    fontWeight: fw,
                    strokeWidth: Math.max(0, Math.min(12, Number(item.strokeWidth ?? 2))),
                    start: timelineStart,
                    end: timelineStart + clipDuration,
                    fontSize,
                    color: item.color || '#ffffff',
                    x: Number(item.xPercent || 10),
                    y: Number(item.yPercent || 10),
                    textBoxWidthPercent: Math.max(12, Math.min(100, Number(item.textBoxWidthPercent || 40))),
                    boxColor: item.boxColor || '#00000088'
                });
                return;
            }

            const sourcePath = item.source?.startsWith('data:')
                ? this.materializeDataUrl(item.source, tempFiles)
                : this.resolveToLocalPath(item.source);
            if (!sourcePath || !fs.existsSync(sourcePath)) return;
            const ext = path.extname(sourcePath).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
            const isVideo = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);
            const isAudio = ['.mp3', '.wav', '.aac', '.m4a', '.ogg'].includes(ext);
            if (!isImage && !isVideo && !isAudio) return;

            if (isAudio) {
                pureAudioClips.push({
                    sourcePath,
                    timelineStart,
                    clipDuration,
                    trimStart: Number(item.start || 0)
                });
                return;
            }

            visuals.push({
                sourcePath,
                timelineStart,
                clipDuration,
                clipStart: Number(item.start || 0),
                muted: Boolean(item.muted),
                isImage,
                isVideo,
                layoutXPercent: num(item.layoutXPercent, 0),
                layoutYPercent: num(item.layoutYPercent, 0),
                layoutWidthPercent: num(item.layoutWidthPercent, 100),
                layoutHeightPercent: num(item.layoutHeightPercent, 100),
                trackVisualIndex: num(item.trackVisualIndex, 0)
            });
        });

        timelineDuration = Math.max(0.1, timelineDuration);

        /** Giống preview RenderView: lane index lớn hơn = nền, vẽ trước; lane nhỏ = trên cùng. */
        visuals.sort((a, b) => {
            if (b.trackVisualIndex !== a.trackVisualIndex) return b.trackVisualIndex - a.trackVisualIndex;
            return a.timelineStart - b.timelineStart;
        });

        if (!visuals.length && !textOverlays.length) {
            throw new Error('No valid video/image clips in timeline');
        }

        const inputArgs = [];
        const filterParts = [];
        let inputIndex = 0;

        inputArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${target.w}x${target.h}:r=30:d=${timelineDuration}`);
        inputIndex = 1;

        let currentV = '[0:v]';
        const visualInputIndices = [];

        visuals.forEach((clip, seg) => {
            const { sourcePath, clipDuration, clipStart, timelineStart, isImage } = clip;
            const lx = Math.min(100, Math.max(0, clip.layoutXPercent));
            const ly = Math.min(100, Math.max(0, clip.layoutYPercent));
            const lwP = Math.min(100, Math.max(1, clip.layoutWidthPercent));
            const lhP = Math.min(100, Math.max(1, clip.layoutHeightPercent));
            let boxW = Math.round(target.w * lwP / 100);
            let boxH = Math.round(target.h * lhP / 100);
            let xPx = Math.round(target.w * lx / 100);
            let yPx = Math.round(target.h * ly / 100);
            boxW = Math.max(2, Math.min(target.w, boxW));
            boxH = Math.max(2, Math.min(target.h, boxH));
            xPx = Math.max(0, Math.min(Math.max(0, target.w - boxW), xPx));
            yPx = Math.max(0, Math.min(Math.max(0, target.h - boxH), yPx));

            /**
             * FFmpeg 8: scale+pad trong filtergraph dễ làm tròn sai → pad nhỏ hơn input.
             * Dùng ffprobe lấy iw/ih, tính ow/oh contain trong Node — luôn ow≤bw, oh≤bh — rồi scale=ow:oh + pad cố định.
             */
            const bw = boxW;
            const bh = boxH;
            const { iw, ih } = this.probeVisualStreamDims(sourcePath, probeCache);
            const { ow, oh } = this.containScalePixels(iw, ih, bw, bh);
            const t0 = timelineStart;
            const t1 = timelineStart + clipDuration;
            // Align each clip onto global timeline: local 0..dur -> global t0..t1.
            const subChain = `setpts=PTS-STARTPTS+${t0}/TB,scale=${ow}:${oh},pad=${bw}:${bh}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
            const enable = `enable='between(t\\,${t0}\\,${t1})'`;

            if (isImage) {
                inputArgs.push('-loop', '1', '-t', String(clipDuration), '-i', sourcePath);
            } else if (clipStart > 0) {
                inputArgs.push('-ss', String(clipStart), '-t', String(clipDuration), '-i', sourcePath);
            } else {
                inputArgs.push('-t', String(clipDuration), '-i', sourcePath);
            }
            const inIdx = inputIndex;
            inputIndex += 1;
            visualInputIndices.push(inIdx);

            const clipLabel = `cvl${seg}`;
            const outLabel = `olv${seg}`;
            filterParts.push(`[${inIdx}:v]${subChain}[${clipLabel}]`);
            // Prevent holding the last frame of an ended clip over next segments.
            filterParts.push(`${currentV}[${clipLabel}]overlay=${xPx}:${yPx}:eof_action=pass:repeatlast=0:shortest=0:${enable}[${outLabel}]`);
            currentV = `[${outLabel}]`;
        });

        let videoOutputLabel = currentV;
        let filterComplex = filterParts.join(';');

        if (textOverlays.length) {
            textOverlays.forEach((overlay, idx) => {
                const inputLabel = idx === 0 ? videoOutputLabel : `[txtv${idx - 1}]`;
                const outputLabel = `[txtv${idx}]`;
                const xExpr = `(w-text_w)*${Math.min(100, Math.max(0, overlay.x)) / 100}`;
                const yExpr = `(h-text_h)*${Math.min(100, Math.max(0, overlay.y)) / 100}`;
                const textBoxWidthPx = target.w * (overlay.textBoxWidthPercent / 100);
                const charUnit = Math.max(2.5, overlay.fontSize * 0.52);
                const maxCharsPerLine = Math.max(2, Math.floor(textBoxWidthPx / charUnit));
                const wrappedText = this.escapeDrawText(this.wrapTextByWidth(overlay.text || 'Text', maxCharsPerLine));
                const mode = overlay.textStyle || 'fill';
                const fc = this.ffmpegColor(overlay.color);
                let drawParams = `text='${wrappedText}':fontcolor=${fc}:fontsize=${overlay.fontSize}:x=${xExpr}:y=${yExpr}`;
                if (mode === 'fill') {
                    drawParams += `:box=1:boxcolor=${this.ffmpegColor(overlay.boxColor)}`;
                } else if (mode === 'outline') {
                    const sw = Math.max(0, Math.min(12, Number(overlay.strokeWidth ?? 2)));
                    const borderPx = Math.max(0, Math.round(sw * textFontScale));
                    drawParams += `:box=0:borderw=${borderPx}`;
                    drawParams += `:bordercolor=${fc}`;
                } else {
                    drawParams += ':box=0';
                }
                filterComplex += `;${inputLabel}drawtext=${drawParams}:enable='between(t,${overlay.start},${overlay.end})'${outputLabel}`;
                videoOutputLabel = outputLabel;
            });
        }

        const sampleRate = 44100;
        const wholeSamples = Math.max(sampleRate, Math.ceil(timelineDuration * sampleRate));
        const audioBranchLabels = [];
        let audSeg = 0;

        visuals.forEach((clip, seg) => {
            if (!clip.isVideo || clip.muted) return;
            const inIdx = visualInputIndices[seg];
            const delayMs = Math.round(clip.timelineStart * 1000);
            const br = `aud${audSeg}`;
            audSeg += 1;
            filterComplex += `;[${inIdx}:a]aresample=${sampleRate},atrim=duration=${clip.clipDuration},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},apad=whole_len=${wholeSamples}[${br}]`;
            audioBranchLabels.push(`[${br}]`);
        });

        pureAudioClips.forEach((ac) => {
            if (ac.trimStart > 0) inputArgs.push('-ss', String(ac.trimStart));
            inputArgs.push('-t', String(ac.clipDuration), '-i', ac.sourcePath);
            const inIdx = inputIndex;
            inputIndex += 1;
            const delayMs = Math.round(ac.timelineStart * 1000);
            const br = `aud${audSeg}`;
            audSeg += 1;
            filterComplex += `;[${inIdx}:a]aresample=${sampleRate},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},apad=whole_len=${wholeSamples}[${br}]`;
            audioBranchLabels.push(`[${br}]`);
        });

        if (audioBranchLabels.length === 0) {
            inputArgs.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=${sampleRate}`, '-t', String(timelineDuration));
            const silIdx = inputIndex;
            inputIndex += 1;
            filterComplex += `;[${silIdx}:a]anull[outa]`;
        } else if (audioBranchLabels.length === 1) {
            const only = audioBranchLabels[0];
            filterComplex += `;${only}aformat=sample_fmts=fltp:channel_layouts=stereo[outa]`;
        } else {
            const joined = audioBranchLabels.join('');
            filterComplex += `;${joined}amix=inputs=${audioBranchLabels.length}:normalize=0:duration=longest[amxb];[amxb]aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${timelineDuration},asetpts=PTS-STARTPTS[outa]`;
        }

        return { inputArgs, filterComplex, videoOutputLabel, tempFiles, timelineDuration };
    }

    executeRender({
        inputArgs,
        filterComplex,
        videoOutputLabel,
        outputPath,
        totalDuration = 0,
        onProgress,
        onSpawn,
        jobId
    }) {
        return new Promise((resolve, reject) => {
            const args = [
                ...inputArgs,
                '-progress', 'pipe:2',
                '-nostats',
                '-filter_complex', filterComplex,
                '-map', videoOutputLabel,
                '-map', '[outa]',
                ...(totalDuration > 0 ? ['-t', String(totalDuration)] : []),
                '-r', '30',
                '-pix_fmt', 'yuv420p',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-movflags', '+faststart',
                '-y',
                outputPath
            ];
            if (!FFMPEG_PATH) {
                reject(new Error('ffmpeg binary not found. Please reinstall app dependencies.'));
                return;
            }
            const proc = spawn(FFMPEG_PATH, args, { windowsHide: true });
            if (typeof onSpawn === 'function') {
                try {
                    onSpawn(proc);
                } catch (_) { /* ignore */ }
            }
            let stderr = '';
            proc.stderr.on('data', (chunk) => {
                const text = chunk.toString();
                stderr += text;
                if (!onProgress) return;
                const msMatch = text.match(/out_time_ms=(\d+)/);
                if (msMatch && totalDuration > 0) {
                    const outSec = Number(msMatch[1]) / 1000000;
                    const progress = Math.min(0.99, outSec / totalDuration);
                    onProgress(progress);
                }
            });
            proc.on('error', (err) => reject(new Error(`Failed to start ffmpeg: ${err.message}`)));
            proc.on('close', (code) => {
                const job = jobId && this.jobs.has(jobId) ? this.jobs.get(jobId) : null;
                if (job?.status === 'cancelled') {
                    resolve();
                    return;
                }
                if (code !== 0 && code !== null) {
                    reject(new Error(stderr || `ffmpeg exited with code ${code}`));
                    return;
                }
                resolve();
            });
        });
    }

    async render(req, res) {
        try {
            const plan = this.buildRenderPlan(req.body || {});
            const outputName = `render-${Date.now()}.mp4`;
            const outputPath = path.join(RENDER_DIR, outputName);
            await this.executeRender({
                ...plan,
                outputPath,
                totalDuration: plan.timelineDuration
            });
            plan.tempFiles.forEach((filePath) => {
                if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
            });
            const url = `http://localhost:27123/renders/${outputName}`;
            return res.status(200).json({ success: true, data: { url, outputName } });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async startRender(req, res) {
        try {
            const { outputPath } = req.body || {};
            const plan = this.buildRenderPlan(req.body || {});
            const jobId = crypto.randomUUID();
            const outputName = outputPath
                ? path.basename(outputPath)
                : `render-${Date.now()}.mp4`;
            const finalOutput = outputPath || path.join(RENDER_DIR, outputName);
            this.jobs.set(jobId, {
                status: 'running',
                progress: 0,
                outputPath: finalOutput,
                outputName,
                error: '',
                proc: null
            });

            this.executeRender({
                ...plan,
                outputPath: finalOutput,
                totalDuration: plan.timelineDuration,
                jobId,
                onSpawn: (proc) => {
                    const job = this.jobs.get(jobId);
                    if (job) job.proc = proc;
                },
                onProgress: (progress) => {
                    const job = this.jobs.get(jobId);
                    if (job) job.progress = Math.max(job.progress, progress);
                }
            }).then(() => {
                const job = this.jobs.get(jobId);
                if (!job) return;
                if (job.status === 'cancelled') return;
                job.status = 'completed';
                job.progress = 1;
                job.url = outputPath
                    ? `file:///${finalOutput.replace(/\\/g, '/')}`
                    : `http://localhost:27123/renders/${job.outputName}`;
            }).catch((error) => {
                const job = this.jobs.get(jobId);
                if (!job) return;
                if (job.status === 'cancelled') {
                    job.error = '';
                    return;
                }
                job.status = 'error';
                job.error = error.message;
            }).finally(() => {
                const job = this.jobs.get(jobId);
                if (job) job.proc = null;
                plan.tempFiles.forEach((filePath) => {
                    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
                });
            });

            return res.status(200).json({ success: true, data: { jobId, outputName } });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getRenderJob(req, res) {
        const { jobId } = req.params || {};
        if (!jobId || !this.jobs.has(jobId)) {
            return res.status(404).json({ success: false, message: 'Render job not found' });
        }
        const job = this.jobs.get(jobId);
        const safe = { ...job };
        delete safe.proc;
        return res.status(200).json({ success: true, data: safe });
    }

    /** Dừng ffmpeg của job (không xóa job — client poll status cancelled). */
    async cancelRenderJob(req, res) {
        try {
            const { jobId } = req.params || {};
            if (!jobId || !this.jobs.has(jobId)) {
                return res.status(404).json({ success: false, message: 'Render job not found' });
            }
            const job = this.jobs.get(jobId);
            if (job.status !== 'running') {
                return res.status(200).json({ success: true, data: { status: job.status } });
            }
            job.status = 'cancelled';
            job.progress = 0;
            if (job.proc && !job.proc.killed) {
                try {
                    job.proc.kill('SIGTERM');
                } catch (_) { /* ignore */ }
            }
            return res.status(200).json({ success: true, data: { status: 'cancelled' } });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new RenderService();

