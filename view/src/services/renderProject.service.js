import { projectService } from './project.service.js';
import { storyboardService } from './storyboard.service.js';

export const RENDER_PROJECT_KIND = {
    workflow: 'workflow',
    storyboard: 'storyboard',
};

/** Timeline + asset upload API for RenderView (workflow vs storyboard projects). */
export function getRenderProjectApi(kind = RENDER_PROJECT_KIND.workflow) {
    if (kind === RENDER_PROJECT_KIND.storyboard) {
        return {
            getTimeline: (id) => storyboardService.getTimeline(id),
            saveTimeline: (id, data) => storyboardService.saveTimeline(id, data),
            saveAssetFile: (id, file, opts = {}) => storyboardService.saveAssetFile(id, file, {
                kind: opts.kind || 'render-resource',
                sceneIndex: opts.sceneIndex ?? null,
            }),
        };
    }
    return {
        getTimeline: (id) => projectService.getTimeline(id),
        saveTimeline: (id, data) => projectService.saveTimeline(id, data),
        saveAssetFile: (id, file, opts = {}) => projectService.saveAssetFile(id, file, {
            nodeId: opts.nodeId || 'render-resource',
            kind: opts.kind || 'asset',
        }),
    };
}
