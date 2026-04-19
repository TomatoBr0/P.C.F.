document.addEventListener('DOMContentLoaded', () => {
    const completeBtn = document.getElementById('complete-btn');
    const captureBtn = document.getElementById('capture-btn');
    const autoToggle = document.getElementById('auto-toggle');
    const widgetToggle = document.getElementById('widget-toggle');
    const statusPill = document.getElementById('status-pill');
    const statusText = document.getElementById('status-text');

    // Load saved settings
    chrome.storage.local.get(['autoApply', 'showWidget'], (result) => {
        autoToggle.checked = result.autoApply !== undefined ? result.autoApply : true;
        widgetToggle.checked = result.showWidget !== undefined ? result.showWidget : true;
        updateStatus(autoToggle.checked);
    });

    // Auto-Fill toggle
    autoToggle.addEventListener('change', async () => {
        const enabled = autoToggle.checked;
        chrome.storage.local.set({ autoApply: enabled });
        updateStatus(enabled);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: (val) => {
                    localStorage.setItem('cbhelper_autoApply', val);
                    window.postMessage({ type: 'CB_SET_AUTO', enabled: val }, '*');
                },
                args: [enabled]
            });
        }
    });

    // Floating Widget toggle
    widgetToggle.addEventListener('change', async () => {
        const show = widgetToggle.checked;
        chrome.storage.local.set({ showWidget: show });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: (val) => {
                    localStorage.setItem('cbhelper_showWidget', val);
                    window.postMessage({ type: 'CB_SET_WIDGET', show: val }, '*');
                },
                args: [show]
            });
        }
    });

    // Manual trigger
    completeBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const btnText = completeBtn.querySelector('.btn-text');
        const original = btnText.innerText;
        btnText.innerText = "Running...";

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    try {
                        const iframe = document.querySelector('iframe#interactiveIframe');
                        const w = iframe ? iframe.contentWindow : window;
                        if (!w) return { success: false };

                        // Domain check for safety
                        const h = window.location.hostname.toLowerCase();
                        if (h.includes('google.com') || h.includes('login') || h.includes('auth')) return { success: false, blocked: true };

                        let didSomething = false;

                        // 1. Fill standard progress
                        const p = w.progressLevelList;
                        if (p && p.includes(0) || p && p.includes(1)) {
                            p.fill(2);
                            didSomething = true;
                        }

                        // 2. Fill inputs/boxes
                        try {
                            const inputs = w.document.querySelectorAll('input, .energy-box, .PE, .KE, [class*=box]');
                            if (inputs.length > 0) {
                                let changed = false;
                                inputs.forEach(e => {
                                    // Protect critical UI/Login/Search inputs
                                    const t = (e.type || '').toLowerCase();
                                    const n = (e.name || '').toLowerCase();
                                    const i = (e.id || '').toLowerCase();
                                    const p = (e.placeholder || '').toLowerCase();
                                    const c = (typeof e.className === 'string' ? e.className : '').toLowerCase();

                                    if (['hidden', 'password', 'email', 'submit', 'button', 'search'].includes(t)) return;
                                    if (e.readOnly || e.disabled) return;

                                    // Prevent overwriting login/user fields
                                    const sensitive = /user|login|email|pass|search|account|member|id|identifier|name|auth|username|password/i;
                                    const autoMatch = (e.getAttribute('autocomplete') || '').toLowerCase();
                                    if (sensitive.test(n) || sensitive.test(i) || sensitive.test(p) || sensitive.test(c) || /username|email|password/i.test(autoMatch)) return;

                                    // Special check: skip if label or surrounding text suggests it's a username/name field
                                    const labelText = (e.labels && e.labels[0] ? e.labels[0].textContent : '').toLowerCase();
                                    const ariaLabel = (e.getAttribute('aria-label') || '').toLowerCase();
                                    if (/name|user|login|id|account/i.test(labelText) || /name|user|login|id|account/i.test(ariaLabel)) return;

                                    if (e.value !== '10' && e.textContent !== '10') {
                                        if ('value' in e) e.value = '10';
                                        e.textContent = '10';
                                        changed = true;
                                    }
                                });
                                if (changed) didSomething = true;
                            }
                        } catch (err) { }

                        // 3. Solve Matching Pairs (HYPE documents)
                        if (w.HYPE && w.HYPE.documents && !w.pcFastIsSolvingMP) {
                            const d = w.HYPE.documents[Object.keys(w.HYPE.documents)[0]];
                            const o = d.getElementById('MPdisplayOrderList');
                            const numMatches = d.getElementById('MPnumMatches');

                            // Skip if already solved to prevent infinite loop/Wrong feedback
                            if (numMatches && numMatches.innerHTML === '4') return { success: true };

                            if (o && o.innerHTML) {
                                const displayOrder = o.innerHTML.split(',').map(Number);
                                const v = ["01", "10", "23", "32", "45", "54", "67", "76"];
                                const c = [];

                                for (let a = 0; a < 8; a++) {
                                    for (let b = a + 1; b < 8; b++) {
                                        const l = displayOrder[a] + '' + displayOrder[b];
                                        if (v.includes(l)) {
                                            c.push([a + 1, b + 1]);
                                            break;
                                        }
                                    }
                                }

                                if (c.length === 4) {
                                    w.pcFastIsSolvingMP = true;
                                    didSomething = true;

                                    function solvePair(j) {
                                        if (j >= c.length) {
                                            if (w.progressLevelList && typeof w.pickedGroup !== 'undefined') {
                                                w.progressLevelList[w.pickedGroup] = 2;
                                            }
                                            if (w.displayProgress) w.displayProgress(d, null, null);

                                            // Optional: auto-nextStep for manual trigger too
                                            setTimeout(() => {
                                                if (d.functions().nextStep) {
                                                    try { d.functions().nextStep(d, null, null); } catch (e) { }
                                                }
                                                w.pcFastIsSolvingMP = false;
                                            }, 2000);
                                            return;
                                        }

                                        const r = c[j];
                                        const tappedEl = d.getElementById('MPtappedOption');
                                        if (tappedEl && d.functions().MPtappedOption) {
                                            tappedEl.innerHTML = r[0];
                                            d.functions().MPtappedOption(d, null, null);

                                            setTimeout(() => {
                                                tappedEl.innerHTML = r[1];
                                                d.functions().MPtappedOption(d, null, null);

                                                setTimeout(() => {
                                                    if (d.functions().MPCheckMatch) d.functions().MPCheckMatch(d, null, null);
                                                    setTimeout(() => solvePair(j + 1), 1000);
                                                }, 500);
                                            }, 500);
                                        } else {
                                            w.pcFastIsSolvingMP = false;
                                        }
                                    }

                                    solvePair(0);
                                    return { success: true };
                                }
                            }
                        }

                        return { success: didSomething };
                    } catch (e) {
                        return { success: false };
                    }
                }
            });

            const result = results?.[0]?.result;
            if (result?.success) {
                btnText.innerText = "Done! ✅";
                completeBtn.classList.add('success');
                statusText.innerText = "Filled";
                statusPill.classList.remove('idle');
            } else {
                btnText.innerText = "Not Ready";
                statusText.innerText = "Waiting";
                statusPill.classList.add('idle');
            }
        } catch (err) {
            btnText.innerText = "Error";
        }
        setTimeout(() => {
            btnText.innerText = original;
            completeBtn.classList.remove('success');
        }, 2500);
    });

    function updateStatus(auto) {
        if (auto) {
            statusText.innerText = "Active";
            statusPill.classList.remove('idle');
        } else {
            statusText.innerText = "Manual";
            statusPill.classList.add('idle');
        }
    }

    // Capture Page DOM
    captureBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const btnText = captureBtn.querySelector('.btn-text');
        const original = btnText.innerText;
        btnText.innerText = "Capturing...";

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    try {
                        let docHTML = document.documentElement.outerHTML;

                        // Include iframe content if available
                        try {
                            const iframe = document.querySelector('iframe#interactiveIframe');
                            if (iframe && iframe.contentDocument) {
                                docHTML = `<!-- MAIN DOCUMENT -->\n${docHTML}\n\n<!-- IFRAME DOCUMENT -->\n${iframe.contentDocument.documentElement.outerHTML}`;
                            } else if (iframe) {
                                docHTML += "\n\n<!-- Iframe found but contentDocument not accessible -> Cross-origin or not loaded -->";
                            }
                        } catch (e) {
                            docHTML += "\n\n<!-- Could not access iframe content -->";
                        }

                        const blob = new Blob([docHTML], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");

                        let count = parseInt(localStorage.getItem('pc_capture_count') || '1', 10);
                        localStorage.setItem('pc_capture_count', count + 1);

                        a.href = url;
                        a.download = `pc${count}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 100);
                    } catch (e) {
                        console.error('Capture failed:', e);
                    }
                }
            });
            btnText.innerText = "Captured! ✅";
            captureBtn.classList.add('success');
        } catch (err) {
            btnText.innerText = "Error";
        }

        setTimeout(() => {
            btnText.innerText = original;
            captureBtn.classList.remove('success');
        }, 2500);
    });

    const solutionsBtn = document.getElementById('solutions-btn');
    const solutionContainer = document.getElementById('solution-container');
    const solutionList = document.getElementById('solution-list');
    const closeSolutions = document.getElementById('close-solutions');

    solutionsBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const btnText = solutionsBtn.querySelector('.btn-text');
        const original = btnText.innerText;
        btnText.innerText = "Extracting...";

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    try {
                        const iframe = document.querySelector('iframe#interactiveIframe');
                        const w = iframe ? iframe.contentWindow : window;
                        if (!w || !w.HYPE || !w.HYPE.documents) return { success: false, error: 'No Hype simulation found' };

                        const docKey = Object.keys(w.HYPE.documents)[0];
                        const d = w.HYPE.documents[docKey];
                        const fns = d.functions();
                        const solutions = {};

                        const qaRegex = /var\s+QAList\s*=\s*([^;]+);/;

                        for (let name in fns) {
                            const src = fns[name].toString();
                            const match = src.match(qaRegex);
                            if (match) {
                                let cleanStr = match[1].trim();
                                // Basic cleanup for evaluation
                                try {
                                    // Try to evaluate the array literal safely
                                    // We wrap it in parens to make it an expression
                                    const data = new Function(`return ${cleanStr}`)();
                                    solutions[name] = data;
                                } catch (e) {
                                    solutions[name] = "Raw: " + cleanStr;
                                }
                            }
                        }
                        return { success: Object.keys(solutions).length > 0, answers: solutions };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                }
            });

            const result = results?.[0]?.result;
            if (result?.success) {
                renderSolutions(result.answers, result.activeIndex);
                solutionContainer.classList.remove('hidden');
                btnText.innerText = "Solutions Found! 💡";
                solutionsBtn.classList.add('success');
            } else {
                btnText.innerText = result?.error || "No Solutions Found";
            }
        } catch (err) {
            btnText.innerText = "Error";
            console.error(err);
        }

        setTimeout(() => {
            btnText.innerText = original;
            solutionsBtn.classList.remove('success');
        }, 2500);
    });

    function renderSolutions(answers, activeIndex) {
        solutionList.innerHTML = '';
        for (const [name, value] of Object.entries(answers)) {
            const headerItem = document.createElement('div');
            headerItem.className = 'set-header';
            headerItem.style = "font-size: 0.6rem; color: var(--text-muted); margin: 8px 0 4px; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;";
            headerItem.textContent = `Set: ${name}`;
            solutionList.appendChild(headerItem);

            if (Array.isArray(value)) {
                value.forEach((val, idx) => {
                    const item = document.createElement('div');
                    item.className = 'solution-item';
                    if (idx === activeIndex) item.classList.add('active');

                    const details = document.createElement('div');
                    details.className = 'solution-details';

                    const label = document.createElement('span');
                    label.className = 'solution-name';
                    label.textContent = idx === activeIndex ? `🎯 CURRENT MISSION (#${idx + 1})` : `Mission #${idx + 1}`;
                    if (idx === activeIndex) label.style.color = 'var(--accent-amber)';

                    const valEl = document.createElement('span');
                    valEl.className = 'solution-value';
                    const displayVal = Array.isArray(val) ? `[${val.join(', ')}]` : String(val);
                    valEl.textContent = displayVal;

                    details.appendChild(label);
                    details.appendChild(valEl);
                    item.appendChild(details);

                    // Copy Button
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'copy-btn';
                    copyBtn.title = 'Copy answer';
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                    copyBtn.onclick = () => {
                        const textToCopy = Array.isArray(val) ? val.join(',') : String(val);
                        navigator.clipboard.writeText(textToCopy);
                        copyBtn.style.color = 'var(--accent-green)';
                        setTimeout(() => copyBtn.style.color = '', 1500);
                    };
                    item.appendChild(copyBtn);

                    solutionList.appendChild(item);

                    if (idx === activeIndex) {
                        setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                    }
                });
            } else {
                const item = document.createElement('div');
                item.className = 'solution-item';
                const valEl = document.createElement('span');
                valEl.className = 'solution-value';
                valEl.textContent = value;
                item.appendChild(valEl);
                solutionList.appendChild(item);
            }
        }
    }

    closeSolutions.addEventListener('click', () => {
        solutionContainer.classList.add('hidden');
    });

    const downloadLogsBtn = document.getElementById('download-logs-btn');
    downloadLogsBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const btnText = downloadLogsBtn.querySelector('.btn-text');
        const original = btnText.innerText;
        btnText.innerText = "Downloading...";

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    try {
                        const logs = JSON.parse(localStorage.getItem('pcf_logs') || '[]');
                        if (logs.length === 0) {
                            alert('No logs found yet.');
                            return;
                        }

                        const logText = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message} (URL: ${l.url})`).join('\n');
                        const blob = new Blob([logText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `pcf_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 100);
                    } catch (e) {
                        console.error('Log download failed:', e);
                    }
                }
            });
            downloadLogsBtn.innerText = "Downloaded! ✅";
            downloadLogsBtn.classList.add('success');
        } catch (err) {
            btnText.innerText = "Error";
        }

        setTimeout(() => {
            btnText.innerText = original;
            downloadLogsBtn.classList.remove('success');
        }, 2500);
    });

    const scanBtn = document.getElementById('scan-btn');
    scanBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const btnText = scanBtn.querySelector('.btn-text');
        const original = btnText.innerText;
        btnText.innerText = 'Scanning...';

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    if (typeof window.pcFastRunDiagnostic === 'function') {
                        return window.pcFastRunDiagnostic();
                    }
                    return null;
                }
            });

            const resultData = results?.[0]?.result;
            const report = (resultData && typeof resultData === 'object') ? resultData.report : resultData;
            const data = (resultData && typeof resultData === 'object') ? resultData.data : null;

            if (report) {
                await navigator.clipboard.writeText(report);
                btnText.innerText = 'Copied! 📋';
                scanBtn.classList.add('success');

                // If smart formulas detected, show a special notice
                if (data && data.smartFormulas && data.smartFormulas.length > 0) {
                    const formula = data.smartFormulas[0].formula;
                    statusText.innerText = `Pattern: ${formula}`;
                    statusPill.classList.remove('idle');
                }
            } else {
                btnText.innerText = 'No HYPE found';
            }
        } catch (err) {
            btnText.innerText = 'Error';
            console.error(err);
        }

        setTimeout(() => {
            btnText.innerText = original;
            scanBtn.classList.remove('success');
        }, 2500);
    });
});
