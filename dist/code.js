"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 340, height: 200 });
function convertFrameToImage(frame) {
    return __awaiter(this, void 0, void 0, function* () {
        const bytes = yield frame.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 }
        });
        return bytes;
    });
}
function createAnimation(frames, format) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Converting ${frames.length} frames to ${format}`);
        const totalBytes = frames.reduce((sum, frame) => sum + frame.length, 0);
        console.log(`Total bytes to process: ${totalBytes}`);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Finished converting to ${format}`);
                resolve(true);
            }, Math.min(totalBytes / 1000, 3000));
        });
    });
}
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'convert') {
        try {
            const selection = figma.currentPage.selection;
            if (selection.length === 0) {
                figma.ui.postMessage({
                    type: 'error',
                    message: 'Please select at least one frame to convert'
                });
                return;
            }
            const frames = selection.filter((node) => node.type === "FRAME");
            if (frames.length === 0) {
                figma.ui.postMessage({
                    type: 'error',
                    message: 'Please select frames only'
                });
                return;
            }
            const frameImages = yield Promise.all(frames.map(frame => convertFrameToImage(frame)));
            yield createAnimation(frameImages, msg.format);
            figma.ui.postMessage({ type: 'success' });
        }
        catch (error) {
            figma.ui.postMessage({
                type: 'error',
                message: 'Error converting frames: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
});
