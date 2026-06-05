/**
 * Extract human-readable error from Nano / Flow API responses.
 * Prefers nested provider errors (e.g. data.result.error.message) over generic wrapper messages.
 */

export function extractNanoFlowErrorMessage(payload) {
    if (!payload || typeof payload !== 'object') return 'Task failed'

    const mediaErrors = (payload?.data?.media || [])
        .map((m) => {
            const mediaStatus = m?.mediaMetadata?.mediaStatus
            const primary = mediaStatus?.error?.message || ''
            const reason = Array.isArray(mediaStatus?.failureReasons) && mediaStatus.failureReasons.length
                ? mediaStatus.failureReasons.join(', ')
                : ''
            return [primary, reason].filter(Boolean).join(' | ')
        })
        .filter(Boolean)
    if (mediaErrors.length) return mediaErrors[0]

    const resultError = payload?.data?.result?.error
    if (resultError?.message) {
        const reasons = Array.isArray(resultError.details)
            ? resultError.details.map((d) => d?.reason).filter(Boolean)
            : []
        const msg = String(resultError.message).trim()
        if (reasons.length) return `${msg} (${reasons.join(', ')})`
        return msg
    }

    const nested = payload?.data?.error
    if (nested?.message) return String(nested.message).trim()

    const parts = [
        nested?.status,
        typeof payload?.data === 'string' ? payload.data : '',
        typeof payload?.data?.result === 'string' ? payload.data.result : '',
        typeof payload?.error === 'string' ? payload.error : '',
        payload?.message,
    ].filter((s) => typeof s === 'string' && String(s).trim())

    return parts[0] || 'Task failed'
}

export function errorMessageFromUnknown(err, fallback = 'Task failed') {
    if (!err) return fallback
    if (err?.flowPayload) {
        const fromPayload = extractNanoFlowErrorMessage(err.flowPayload)
        if (fromPayload && fromPayload !== 'Task failed') return fromPayload
    }
    const msg = String(err?.message || '').trim()
    return msg || fallback
}

export function throwNanoFlowError(payload, fallback = 'Task failed') {
    const message = extractNanoFlowErrorMessage(payload) || fallback
    const err = new Error(message)
    err.flowPayload = payload
    throw err
}
