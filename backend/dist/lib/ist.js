"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.istNow = istNow;
exports.istToday = istToday;
exports.istHour = istHour;
/** IST (UTC+05:30) date helpers — shared between backend and frontend */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istNow() {
    return new Date(Date.now() + IST_OFFSET_MS);
}
function istToday() {
    return istNow().toISOString().slice(0, 10);
}
function istHour() {
    return istNow().getUTCHours();
}
