#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

// Strip control characters so names can't inject terminal escape sequences
const stripControl = s => String(s).replace(/[\x00-\x1f\x7f-\x9f]/g, '');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = stripControl((data.model.display_name || '').split(' ')[0]);
    const dir = stripControl(path.basename(data.workspace.current_dir));
    const pct = Math.floor(data.context_window?.used_percentage || 0);
    const durationMs = data.cost?.total_duration_ms || 0;
    const sessionPct = data.rate_limits?.five_hour?.used_percentage ?? null;

    const CYAN = '\x1b[36m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', GREY = '\x1b[90m', BLUE = '\x1b[94m', ORANGE = '\x1b[38;5;208m', RESET = '\x1b[0m';

    const barColor = pct >= 90 ? RED : pct >= 70 ? YELLOW : GREY;
    const filled = Math.floor(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const mins = Math.floor(durationMs / 60000);
    const secs = Math.floor((durationMs % 60000) / 1000);

    let sessionBar = '';
    if (sessionPct !== null) {
        const sPct = Math.floor(sessionPct);
        const sColor = sPct >= 90 ? RED : sPct >= 60 ? YELLOW : GREEN;
        const sFilled = Math.floor(sPct / 10);
        const sBar = '█'.repeat(sFilled) + '░'.repeat(10 - sFilled);
        const resetsAt = data.rate_limits?.five_hour?.resets_at ?? null;
        let resetStr = '';
        if (resetsAt !== null) {
            const diffMs = resetsAt * 1000 - Date.now();
            const diffH = (diffMs / 3600000).toFixed(2).replace(/\.?0+$/, '');
            resetStr = diffMs > 0 ? ` ${GREY}${diffH}h${RESET}` : '';
        }
        sessionBar = ` | ${sColor}${sBar}${RESET} ${sPct}%${resetStr}`;
    }

    let weeklyBar = '';
    const weeklyPct = data.rate_limits?.seven_day?.used_percentage ?? null;
    if (weeklyPct !== null) {
        const wPct = Math.floor(weeklyPct);
        const wColor = wPct >= 80 ? RED : wPct >= 50 ? ORANGE : BLUE;
        const wFilled = Math.floor(wPct / 10);
        const wBar = '█'.repeat(wFilled) + '░'.repeat(10 - wFilled);
        weeklyBar = ` | ${wColor}${wBar}${RESET} ${wPct}%`;
    }

    let branch = '';
    try {
        branch = stripControl(execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim());
        branch = branch ? ` | 🌿 ${branch}` : '';
    } catch {}

    console.log(`${CYAN}[${model}]${RESET} 📁 ${dir}${branch} | ${barColor}${bar}${RESET} ${pct}%${sessionBar}${weeklyBar} | ⏱️ ${mins}m ${secs}s`);
});
