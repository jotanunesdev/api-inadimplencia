"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVideoDurationSeconds = getVideoDurationSeconds;
const child_process_1 = require("child_process");
const ffprobe_static_1 = __importDefault(require("ffprobe-static"));
async function getVideoDurationSeconds(filePath) {
    const ffprobePath = ffprobe_static_1.default.path;
    return new Promise((resolve) => {
        const args = [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nokey=1:noprint_wrappers=1",
            filePath,
        ];
        const proc = (0, child_process_1.spawn)(ffprobePath, args, { windowsHide: true });
        let stdout = "";
        proc.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        proc.on("error", () => resolve(null));
        proc.on("close", (code) => {
            if (code !== 0) {
                resolve(null);
                return;
            }
            const value = Number.parseFloat(stdout.trim());
            if (!Number.isFinite(value) || value <= 0) {
                resolve(null);
                return;
            }
            resolve(Math.round(value));
        });
    });
}
