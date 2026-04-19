(function () {
    console.log('🎮 PC Fast: Active & Monitoring');

    // ==================== SETTINGS ====================
    function isAutoEnabled() {
        const val = localStorage.getItem('cbhelper_autoApply');
        return val === null ? true : val === 'true';
    }

    function isWidgetEnabled() {
        const val = localStorage.getItem('cbhelper_showWidget');
        return val === null ? true : val === 'true';
    }

    // ==================== LOGGER ====================
    function logEvent(message, type = 'info', details = null) {
        try {
            const timestamp = new Date().toLocaleTimeString();
            const entry = { timestamp, message, type, url: window.location.href, details };

            const logs = JSON.parse(localStorage.getItem('pcf_logs') || '[]');
            logs.unshift(entry);

            // Keep only last 200 logs
            if (logs.length > 200) logs.pop();
            localStorage.setItem('pcf_logs', JSON.stringify(logs));

            window.postMessage({ type: 'CB_LOG_UPDATE', logs }, '*');
        } catch (e) {
            console.error('Logging failed:', e);
        }
    }

    logEvent('Extension initialized', 'system');

    // ==================== HELPERS ====================
    function shouldRunOnDomain() {
        const h = window.location.hostname.toLowerCase();
        // Explicitly block sensitive auth domains
        if (h.includes('accounts.google.com') || h.includes('login') || h.includes('auth')) return false;

        // Allowed domains (Physics Classroom and related)
        const allowed = ['physicsclassroom.com', 'fliplt.com', 'conceptbuilder.org', 'physicscentral.com'];
        return allowed.some(domain => h.includes(domain));
    }

    // ==================== ANTI-ADBLOCK (AGGRESSIVE) ====================
    let lastAggressiveDispelTime = 0;
    const AGGRESSIVE_DISPEL_INTERVAL = 3000; // Search all divs every 3s
    const clickedButtons = new Set();

    function dispelAdBlockPopups() {
        if (!shouldRunOnDomain()) return;
        try {
            const now = Date.now();
            let removedSomething = false;

            // 1. Specific search for verified patterns (Fast)
            const specificSelectors = [
                '[id^="adblock-"]', '[class^="adblock-"]', '.mediavine-adblock-notice',
                '.fc-ab-root', '.tp-modal', '.tp-backdrop', '.pm-overlay'
            ];
            const matchingElements = document.querySelectorAll(specificSelectors.join(','));
            if (matchingElements.length > 0) {
                matchingElements.forEach(el => {
                    if (el.isConnected) {
                        el.style.display = 'none';
                        el.remove();
                        removedSomething = true;
                    }
                });
            }

            // 2. High-performance check before aggressive search
            if (now - lastAggressiveDispelTime > AGGRESSIVE_DISPEL_INTERVAL) {
                lastAggressiveDispelTime = now;

                const commonSignatures = [
                    'disable your adblocker', 'adblock detected', 'sponsor notice',
                    'disable software', 'ad-shield', 'turn off adblock'
                ];

                // Look for fixed/absolute overlays with high z-index
                const overlays = document.querySelectorAll('div, section, aside, body > div');
                overlays.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const isFixed = style.position === 'fixed' || style.position === 'absolute';
                    const zIndex = parseInt(style.zIndex);
                    if (zIndex < 100 || !isFixed) return;

                    const text = (el.innerText || '').toLowerCase();
                    const hasSignature = commonSignatures.some(sig => text.includes(sig));
                    const isKnownBanner = el.id.includes('adblock') || el.className.includes('adblock');

                    if (hasSignature || isKnownBanner) {
                        el.remove();
                        removedSomething = true;
                    }
                });
            }

            // Restore body scroll ONLY if we removed something or if body is currently hidden
            if (removedSomething || document.body.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden') {
                if (document.body.style.overflow !== 'auto') {
                    document.body.style.overflow = 'auto';
                    document.documentElement.style.overflow = 'auto';
                    document.body.style.setProperty('overflow', 'auto', 'important');
                }
            }

            // 3. Auto-click 'Continue' or 'Close' buttons in dialogs (Throttled)
            const actionButtons = document.querySelectorAll('button, a');
            actionButtons.forEach(btn => {
                if (clickedButtons.has(btn)) return;

                const text = (btn.innerText || '').toLowerCase();
                const isAdButton = text === 'continue to site' || text === 'i understand' || (text.includes('close') && (btn.className.includes('ad') || btn.id.includes('ad')));

                if (isAdButton) {
                    // Check visibility to avoid clicking hidden triggers
                    const rect = btn.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0;

                    if (isVisible) {
                        btn.click();
                        clickedButtons.add(btn);
                        // Clean up set occasionally
                        if (clickedButtons.size > 100) clickedButtons.clear();
                    }
                }
            });

        } catch (e) { }
    }

    // ==================== CORE LOGIC ====================
    // Global to store extracted answers and offsets across functions
    let extractedSolutions = null;
    let answerOffsets = {}; // To store detected offsets per set

    // ==================== LIGHT BULB ANATOMY SOLVER ====================
    function solveLightBulbAnatomy(w, d) {
        try {
            const docKeys = Object.keys(w.HYPE.documents);
            if (!docKeys.some(k => k.toLowerCase().includes('lightbulbanatomy'))) return false;

            const userlevel = w.userlevel;
            const selectedQuestion = parseInt(w.selectedQuestion);
            if (!userlevel || isNaN(selectedQuestion)) return false;

            const fns = d.functions();

            // Apprentice (Q1-12)
            if (userlevel === 'Apprentice') {
                const QAList = ["0", "1", "2", "0", "1", "2", "0", "1", "2", "02", "1", "12"];
                const idx = selectedQuestion - 1;
                const answer = QAList[idx];
                if (answer === undefined) return false;

                const op1 = d.getElementById('Act1Option1Picked');
                const op2 = d.getElementById('Act1Option2Picked');
                const op3 = d.getElementById('Act1Option3Picked');

                const current = (op1 ? op1.innerHTML : '') + (op2 ? op2.innerHTML : '') + (op3 ? op3.innerHTML : '');
                if (current === answer) return false;

                if (op1) op1.innerHTML = answer.length >= 1 ? answer[0] : "";
                if (op2) op2.innerHTML = answer.length >= 2 ? answer[1] : "";
                if (op3) op3.innerHTML = answer.length >= 3 ? answer[2] : "";

                logEvent(`💡 LightBulb (Apprentice) Q${selectedQuestion}: ${answer}`, 'success');
                if (fns.evaluate1) setTimeout(() => { try { fns.evaluate1(d, null, null); } catch (e) { } }, 300);
                return true;
            }

            // Master (Q13-24)
            if (userlevel === 'Master') {
                const CA2List = ["1", "0", "0", "0", "2", "2", "2", "2", "2", "2", "0", "1"];
                const idx = selectedQuestion - 13;
                const ca2 = CA2List[idx];
                if (ca2 === undefined) return false;

                const sr1 = d.getElementById('Act2SR1');
                const sr2 = d.getElementById('Act2SR2');

                if (sr1 && sr1.innerHTML === "0" && sr2 && sr2.innerHTML === ca2) return false;

                if (sr1) sr1.innerHTML = "0";
                if (sr2) sr2.innerHTML = ca2;

                logEvent(`💡 LightBulb (Master) Q${selectedQuestion}: 0, ${ca2}`, 'success');
                if (fns.evaluate2) setTimeout(() => { try { fns.evaluate2(d, null, null); } catch (e) { } }, 300);
                return true;
            }

            // Wizard (Q25-48)
            if (userlevel === 'Wizard') {
                const CAList = ["2", "1", "1", "1", "3", "2", "3", "2", "3", "0", "0", "0", "1", "3", "2", "3", "2", "3", "2", "1", "1", "0", "0", "0"];
                const idx = selectedQuestion - 25;
                const ca = CAList[idx];
                if (ca === undefined) return false;

                const sr = d.getElementById('A3SR');
                if (sr && sr.innerHTML === ca) return false;

                if (sr) sr.innerHTML = ca;

                logEvent(`💡 LightBulb (Wizard) Q${selectedQuestion}: ${ca}`, 'success');
                if (fns.evaluate3) setTimeout(() => { try { fns.evaluate3(d, null, null); } catch (e) { } }, 300);
                return true;
            }

            return false;
        } catch (e) {
            logEvent('LightBulb solver error: ' + e.message, 'error');
            return false;
        }
    }

    // ==================== VERTICAL SPRING SOLVER ====================
    function solveVertSpring(w, d) {
        try {
            const docKeys = Object.keys(w.HYPE.documents);
            if (!docKeys.some(k => k.toLowerCase().includes('vertspring'))) return false;

            const userlevel = w.userlevel;
            const selectedQuestion = parseInt(w.selectedQuestion);
            if (!userlevel || isNaN(selectedQuestion)) return false;

            const fns = d.functions();

            // Apprentice & Master (Q1-28)
            if (userlevel === 'Apprentice' || userlevel === 'Master') {
                const CAList = ["2", "3", "4", "4", "1", "3", "1", "2", "1", "2", "2", "4", "2", "4", "4", "1", "3", "2", "3", "4", "2", "4", "2", "4", "1", "2", "1", "2"];
                const idx = selectedQuestion - 1;
                const answer = CAList[idx];
                if (answer === undefined) return false;

                const sr1 = d.getElementById('SR1');
                if (sr1 && sr1.innerHTML === answer) return false;

                if (sr1) sr1.innerHTML = answer;

                logEvent(`➿ VertSpring (${userlevel}) Q${selectedQuestion}: ${answer}`, 'success');
                if (fns.evaluate1) setTimeout(() => { try { fns.evaluate1(d, null, null); } catch (e) { } }, 300);
                return true;
            }

            // Wizard (Q29-52)
            if (userlevel === 'Wizard') {
                const CAList = ["1", "2", "3", "4", "3", "4", "1", "2", "2", "3", "4", "1", "35", "16", "34", "15", "34", "15", "35", "16", "25", "35", "25", "35"];
                const idx = selectedQuestion - 29;
                const answer = CAList[idx];
                if (answer === undefined) return false;

                if (idx < 12) {
                    const sr3 = d.getElementById('SR3');
                    if (sr3 && sr3.innerHTML === answer) return false;
                    if (sr3) sr3.innerHTML = answer;
                } else {
                    const sr3b = d.getElementById('SR3B');
                    // Format is "3,5" for answer "35"
                    const formatted = answer[0] + "," + answer[1];
                    if (sr3b && sr3b.innerHTML === formatted) return false;
                    if (sr3b) sr3b.innerHTML = formatted;
                }

                logEvent(`➿ VertSpring (Wizard) Q${selectedQuestion}: ${answer}`, 'success');
                if (fns.evaluate3) setTimeout(() => { try { fns.evaluate3(d, null, null); } catch (e) { } }, 300);
                return true;
            }

            return false;
        } catch (e) {
            logEvent('VertSpring solver error: ' + e.message, 'error');
            return false;
        }
    }

    // ==================== WAVE INTERFERENCE SOLVER ====================
    // Handles the 3 activity levels for physicsclassroom Wave Interference
    let waveInterferenceSolving = false;

    function solveWaveInterference(w, d) {
        try {
            const userlevel = w.userlevel;
            const selectedQuestion = parseInt(w.selectedQuestion);
            if (!userlevel || isNaN(selectedQuestion)) return false;

            const fns = d.functions();

            // ---- APPRENTICE: Q1-8, multiple choice SR boxes ----
            if (userlevel === 'Apprentice') {
                const QAList = ["CDDCC", "CDDDC", "DDCCC", "DDDCC", "DCDCC", "DCCCD", "DCDCD", "CCCCD"];
                const idx = selectedQuestion - 1;
                if (idx < 0 || idx >= QAList.length) return false;
                const QA = QAList[idx];

                // Check if already filled correctly
                const srA = d.getElementById('A1SRA');
                if (srA && srA.innerHTML === QA[0]) return false; // already done

                d.getElementById('A1SRA').innerHTML = QA[0];
                d.getElementById('A1SRB').innerHTML = QA[1];
                d.getElementById('A1SRC').innerHTML = QA[2];
                d.getElementById('A1SRD').innerHTML = QA[3];
                d.getElementById('A1SRE').innerHTML = QA[4];

                logEvent(`🌊 Wave (Apprentice) Q${selectedQuestion}: filled ${QA}`, 'success');
                if (fns.evaluate1) setTimeout(() => fns.evaluate1(d, null, null), 300);
                return true;
            }

            // ---- MASTER: Q9-16, displacement dropdowns ----
            if (userlevel === 'Master') {
                const QAList = [
                    ["-0.6", "0.0", "-0.4"],
                    ["+0.4", "+0.4", "-0.4"],
                    ["-0.4", "+0.2", "-0.2"],
                    ["+0.4", "-0.4", "-0.2"],
                    ["+0.4", "-0.4", "+0.4"],
                    ["+0.4", "-0.4", "+0.4"],
                    ["+0.2", "+0.1", "+0.8"],
                    ["0.0", "-0.6", "+0.6"]
                ];
                const idx = selectedQuestion - 9;
                if (idx < 0 || idx >= QAList.length) return false;
                const QA = QAList[idx];

                // Check if already filled correctly
                const dispA = d.getElementById('DisplacementA');
                if (dispA && dispA.innerHTML === QA[0]) return false;

                d.getElementById('DisplacementA').innerHTML = QA[0];
                d.getElementById('DisplacementB').innerHTML = QA[1];
                d.getElementById('DisplacementC').innerHTML = QA[2];

                logEvent(`🌊 Wave (Master) Q${selectedQuestion}: filled [${QA.join(', ')}]`, 'success');
                if (fns.evaluate2) setTimeout(() => fns.evaluate2(d, null, null), 300);
                return true;
            }

            // ---- WIZARD: Q17-20, drag-dot snap (evaluate3 always = correct) ----
            if (userlevel === 'Wizard') {
                if (waveInterferenceSolving) return false;

                // Guard: only run on wave interference pages (dotProgress elements must exist)
                const prog1 = d.getElementById('dotProgress1');
                if (!prog1) return false;

                // Check if already solved (all 9 dotProgress filled)
                const prog9 = d.getElementById('dotProgress9');
                if (prog9 && prog9.innerHTML === '9') return false;

                waveInterferenceSolving = true;
                const QNum = selectedQuestion;

                logEvent(`🌊 Wave (Wizard) Q${selectedQuestion}: snapping all dots`, 'success');

                // Snap all 9 dots one by one with small delays
                let i = 1;
                function snapNext() {
                    if (i > 9) {
                        // All dots placed — show check button and evaluate
                        d.getElementById('Q' + QNum + 'Note').innerHTML = "Yep. That's it! You have made the resultant wave.";
                        d.startTimelineNamed('showCheckAnswerBttn', d.kDirectionForward);
                        setTimeout(() => {
                            if (fns.evaluate3) fns.evaluate3(d, null, null);
                            waveInterferenceSolving = false;
                        }, 600);
                        return;
                    }
                    // Set progress marker
                    const dotProg = d.getElementById('dotProgress' + i);
                    if (dotProg) dotProg.innerHTML = String(i);
                    // Snap the dot via timeline
                    try { d.startTimelineNamed('SnapDot' + i, d.kDirectionForward); } catch (e) { }
                    i++;
                    setTimeout(snapNext, 120);
                }
                snapNext();
                return true;
            }

            return false;
        } catch (e) {
            logEvent('Wave solver error: ' + e.message, 'error');
            return false;
        }
    }

    // ==================== ROCKING THE BOAT SOLVER ====================
    let rockingTheBoatSolving = false;

    function solveRockingTheBoat(w, d) {
        try {
            // Only run on this specific activity
            const docKeys = Object.keys(w.HYPE.documents);
            if (!docKeys.some(k => k.toLowerCase().includes('rockingtheboat'))) return false;

            if (rockingTheBoatSolving) return false;

            const userlevel = w.userlevel;
            const selectedQuestion = parseInt(w.selectedQuestion);
            const pickedGroup = parseInt(w.pickedGroup);
            if (!userlevel || isNaN(selectedQuestion) || isNaN(pickedGroup)) return false;

            const fns = d.functions();

            let CAarrayList, idx, diagramAnswer;

            if (userlevel === 'Apprentice') {
                CAarrayList = [
                    [24, 0.20, 5.0, 1.2, 4.8],
                    [32, 0.25, 4.0, 1.6, 8.0],
                    [48, 0.3333, 3.0, 1.8, 16.0],
                    [28, 0.3333, 3.0, 1.2, 9.3333],
                    [36, 0.50, 2.0, 1.3, 18.0],
                    [40.0, 0.25, 4.0, 1.4, 10.0]
                ];
                idx = selectedQuestion - 1;
                diagramAnswer = [1, 1][pickedGroup];
            } else if (userlevel === 'Master') {
                CAarrayList = [
                    [28.0, 0.3333, 3.0, 1.20, 9.333],
                    [36, 0.500, 2.000, 1.3, 18.0],
                    [40.0, 0.25, 4.00, 1.4, 10.0],
                    [8.00, 0.16666, 6.00, 1.5, 1.333],
                    [12, 0.125, 8.00, 1.8, 1.50],
                    [20.0, 0.16666, 6.00, 1.90, 3.333],
                    [8.0, 0.20, 5.00, 1.00, 1.60],
                    [10.0, 0.1666, 6.00, 1.10, 1.66666],
                    [12.0, 0.16666, 6.00, 1.2, 2.0]
                ];
                idx = selectedQuestion - 7;
                diagramAnswer = [1, 3, 4][pickedGroup];
            } else if (userlevel === 'Wizard') {
                CAarrayList = [
                    [8.00, 0.16666, 6.0, 1.5, 1.3333],
                    [12.0, 0.125, 8.0, 1.8, 1.50],
                    [20.0, 0.16666, 6.0, 1.9, 3.3333],
                    [8.00, 0.20, 5.0, 1.0, 1.60],
                    [10.0, 0.1666, 6.0, 1.1, 1.6666],
                    [12.0, 0.16666, 6.0, 1.2, 2.00],
                    [8.0, 0.33333, 3.00, 1.3, 2.66666],
                    [12.0, 0.25, 4.0, 1.4, 3.00],
                    [16.0, 0.20, 5.0, 1.5, 3.20],
                    [6.0, 0.20, 5.0, 1.6, 1.20],
                    [8.0, 0.20, 5.0, 1.7, 1.60],
                    [12.0, 0.125, 8.0, 1.8, 1.50]
                ];
                idx = selectedQuestion - 16;
                diagramAnswer = [3, 4, 5, 6][pickedGroup];
            } else return false;

            if (idx < 0 || idx >= CAarrayList.length || diagramAnswer === undefined) return false;
            const QA = CAarrayList[idx];

            // Check if already filled (within 2% tolerance of first value)
            const q1 = d.getElementById('quantity1');
            const q1Val = q1 ? Number(q1.innerHTML) : NaN;
            if (!isNaN(q1Val) && q1Val !== 0 && Math.abs(q1Val - QA[0]) / QA[0] < 0.03) return false;

            rockingTheBoatSolving = true;
            logEvent(`🚤 RockingBoat (${userlevel}) Q${selectedQuestion} pickedGroup=${pickedGroup}: diagram=${diagramAnswer}, qty=[${QA.join(', ')}]`, 'success');

            // Step 1: select the correct diagram
            const dispDiagram = d.getElementById('DisplayDiagram');
            if (dispDiagram) dispDiagram.innerHTML = String(diagramAnswer);
            if (fns.checkDiagram) {
                try { fns.checkDiagram(d, null, null); } catch (e) { }
            }

            // Step 2: after diagram transition, fill quantities and evaluate
            setTimeout(() => {
                try {
                    for (let i = 0; i < 5; i++) {
                        const el = d.getElementById('quantity' + (i + 1));
                        if (el) el.innerHTML = String(QA[i]);
                    }
                    setTimeout(() => {
                        try { if (fns.evaluate) fns.evaluate(d, null, null); } catch (e) { }
                        rockingTheBoatSolving = false;
                    }, 400);
                } catch (e) {
                    rockingTheBoatSolving = false;
                }
            }, 600);

            return true;
        } catch (e) {
            rockingTheBoatSolving = false;
            logEvent('RockingBoat solver error: ' + e.message, 'error');
            return false;
        }
    }

    function fillProgress() {
        if (!shouldRunOnDomain()) return false;
        try {
            const iframe = document.querySelector('iframe#interactiveIframe');
            const w = iframe ? iframe.contentWindow : window;
            if (!w) return false;

            let didSomething = false;

            // 1. Fill standard progress
            const p = w.progressLevelList;
            if (p && (p.includes(0) || p.includes(1))) {
                p.fill(2);
                console.log('⭐ PC Fast: All levels mastered!');
                logEvent('All levels mastered (progressLevelList filled)', 'success');
                didSomething = true;
            }

            // 2. Try dedicated activity solvers first
            if (w.HYPE && w.HYPE.documents) {
                for (let docKey in w.HYPE.documents) {
                    const d = w.HYPE.documents[docKey];
                    if (solveWaveInterference(w, d)) didSomething = true;
                    if (solveRockingTheBoat(w, d)) didSomething = true;
                    if (solveNameThatHarmonic(w, d)) didSomething = true;
                    if (solveSpectrum(w, d)) didSomething = true;
                    if (solveLightBulbAnatomy(w, d)) didSomething = true;
                    if (solveVertSpring(w, d)) didSomething = true;
                }
            }

            // 3. Extract Answers if not already done or if mission changed
            if (!extractedSolutions) {
                const result = extractHypeAnswers(true); // silent extract
                if (result && result.success) {
                    extractedSolutions = result.answers;
                    answerOffsets = result.offsets || {};
                    console.log('🧠 PC Fast: Answers buffered for Smart Fill');
                }
            }

            // 4. Smart Fill inputs/boxes/text containers
            try {
                // Expanded selectors to include HYPE text-based IDs
                const selectors = [
                    'input', '.energy-box', '.PE', '.KE', '[class*=box]',
                    '[id*="SRA"]', '[id*="SRB"]', '[id*="SRC"]', '[id*="SRD"]', '[id*="SRE"]',
                    '[id^="Displacement"]', '[id^="Object"]', '[id*="Rank"]', '[id*="Arrow"]'
                ];
                const elements = w.document.querySelectorAll(selectors.join(', '));

                if (elements.length > 0) {
                    let changed = false;

                    // Detect active question pointers
                    const pickedGroup = w.pickedGroup;
                    const selectedQuestion = w.selectedQuestion;

                    let changedCount = 0;
                    let filledFields = [];

                    elements.forEach((e) => {
                        // Protect critical UI/Login/Search
                        if (e.tagName && e.tagName.toLowerCase() === 'input') {
                            const t = (e.type || '').toLowerCase();
                            const n = (e.name || '').toLowerCase();
                            if (['hidden', 'password', 'email', 'submit', 'button', 'search'].includes(t)) return;
                            if (e.readOnly || e.disabled) return;
                            if (/user|login|email|pass|search|account|member|id|identifier|name|auth|username|password/i.test(n + e.id + e.placeholder + e.className)) return;
                        }

                        let valueToFill = null;

                        if (extractedSolutions) {
                            for (let setName in extractedSolutions) {
                                let set = extractedSolutions[setName];
                                let offset = answerOffsets[setName] || 0;

                                // Logic for determining the index based on the set's expected pointer
                                let currentIdx = -1;
                                if (setName.includes('evaluate') || setName.includes('Superposition')) {
                                    // These typically use selectedQuestion with an offset
                                    currentIdx = parseInt(selectedQuestion) - offset;
                                } else {
                                    // Default to pickedGroup or selectedQuestion
                                    currentIdx = (typeof pickedGroup !== 'undefined') ? pickedGroup : parseInt(selectedQuestion) - offset;
                                }

                                if (Array.isArray(set) && typeof set[currentIdx] !== 'undefined') {
                                    let missionAnswer = set[currentIdx];

                                    // Distribution logic:
                                    // If answer is "CDDCC" (string) and element ID ends in A, B, C, D, E
                                    if (typeof missionAnswer === 'string' && /SRA|SRB|SRC|SRD|SRE|SRF/.test(e.id)) {
                                        const charMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };
                                        const charIdx = charMap[e.id.slice(-1)];
                                        if (typeof charIdx !== 'undefined' && missionAnswer[charIdx]) {
                                            valueToFill = missionAnswer[charIdx];
                                        }
                                    } else if (Array.isArray(missionAnswer)) {
                                        // Match by index suffix if possible (e.g. DisplacementA -> index 0)
                                        const suffixMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
                                        const lastChar = e.id.slice(-1);
                                        if (suffixMap[lastChar] !== undefined && missionAnswer[suffixMap[lastChar]] !== undefined) {
                                            valueToFill = missionAnswer[suffixMap[lastChar]].toString();
                                        } else {
                                            // Fallback: index within sibling group
                                            const siblings = Array.from(w.document.querySelectorAll('[id^="' + e.id.replace(/[A-Z]$/, '') + '"]'));
                                            const siblingIdx = siblings.indexOf(e);
                                            if (siblingIdx !== -1 && typeof missionAnswer[siblingIdx] !== 'undefined') {
                                                valueToFill = missionAnswer[siblingIdx].toString();
                                            }
                                        }
                                    } else {
                                        valueToFill = missionAnswer.toString();
                                    }
                                    if (valueToFill !== null) break;
                                }
                            }

                            // SELF-EVOLVE FALLBACK: Use discovered formulas if no extracted answer matches
                            if (valueToFill === null && w.pcFastSmartFormulas) {
                                for (let f of w.pcFastSmartFormulas) {
                                    const solvedVal = w[f.array][parseInt(w.selectedQuestion) - f.offset];
                                    if (solvedVal !== undefined) {
                                        valueToFill = solvedVal.toString();
                                        break;
                                    }
                                }
                            }
                        }

                        if (valueToFill === null && !e.value && !e.textContent.trim()) valueToFill = '10'; // Fallback for unknown but empty

                        if (valueToFill !== null && e.value !== valueToFill && e.textContent !== valueToFill) {
                            if ('value' in e) e.value = valueToFill;
                            e.textContent = valueToFill;
                            changedCount++;
                            filledFields.push(`${e.id || e.className || 'element'}: ${valueToFill}`);
                            changed = true;
                        }
                    });
                    if (changed) {
                        logEvent(`🚀 Juicy: Filled ${changedCount} fields!`, 'success', { fields: filledFields });
                        didSomething = true;
                    }
                }
            } catch (err) {
                logEvent('Field filling failed: ' + err.message, 'error');
            }

            // 5. Solve Matching Pairs (HYPE documents)
            if (w.HYPE && w.HYPE.documents && !w.pcFastIsSolvingMP) {
                // Support multiple hype documents
                for (let key in w.HYPE.documents) {
                    const d = w.HYPE.documents[key];
                    const o = d.getElementById('MPdisplayOrderList');
                    const numMatches = d.getElementById('MPnumMatches');

                    // Skip if already solved to prevent infinite loop/Wrong feedback trigger
                    if (numMatches && numMatches.innerHTML === '4') continue;

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
                            console.log('🎖 PC Fast: Starting Matching Pairs Solver!');
                            logEvent('Starting Matching Pairs Solver', 'MP');

                            function solvePair(j) {
                                if (j >= c.length) {
                                    if (w.progressLevelList && typeof w.pickedGroup !== 'undefined') {
                                        w.progressLevelList[w.pickedGroup] = 2;
                                    }
                                    if (w.displayProgress) w.displayProgress(d, null, null);
                                    console.log('🎖 PC Fast: Matching Pairs Solved!');
                                    logEvent('Matching Pairs Solved', 'MP');

                                    // Auto-continue logic: wait 2s then trigger nextStep
                                    logEvent('Auto-continuing in 2s...', 'MP');
                                    setTimeout(() => {
                                        if (d.functions().nextStep) {
                                            logEvent('Executing auto-continue (nextStep)', 'MP');
                                            try { d.functions().nextStep(d, null, null); } catch (e) { }
                                        }
                                        w.pcFastIsSolvingMP = false;
                                    }, 2000);

                                    updateWidgetStatus(true);
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
                            return true;
                        }
                    }
                }
            }

            if (didSomething) {
                console.log('✅ PC Fast: Hacks applied!');
                updateWidgetStatus(true);
            }
            return didSomething;
        } catch (e) {
            return false;
        }
    }

    // Throttled auto-fill
    let lastFillTime = 0;
    const THROTTLE_MS = 250;

    function throttledFill() {
        if (!isAutoEnabled() || !shouldRunOnDomain()) return;
        const now = Date.now();
        if (now - lastFillTime < THROTTLE_MS) return;
        lastFillTime = now;
        fillProgress();
    }

    // MutationObserver
    if (document.documentElement) {
        const observer = new MutationObserver(throttledFill);
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Polling fallback
    // Polling fallback + Always-on Anti-Adblock
    setInterval(() => {
        if (shouldRunOnDomain()) {
            dispelAdBlockPopups();
            throttledFill();
        }
    }, 200);

    // Listen for popup messages
    window.addEventListener('message', (event) => {
        if (event.data === 'CB_COMPLETE_TASKS') fillProgress();
        if (event.data === 'CB_EXTRACT_ANSWERS') extractHypeAnswers();
        if (event.data?.type === 'CB_SET_AUTO') {
            localStorage.setItem('cbhelper_autoApply', event.data.enabled);
            if (event.data.enabled) throttledFill();
        }
        if (event.data?.type === 'CB_SET_WIDGET') {
            localStorage.setItem('cbhelper_showWidget', event.data.show);
            toggleWidget(event.data.show);
        }
    });

    function extractHypeAnswers(silent = false) {
        if (!silent) console.log('🔍 PC Fast: Extracting solutions from HYPE...');
        try {
            const iframe = document.querySelector('iframe#interactiveIframe');
            const w = iframe ? iframe.contentWindow : window;
            if (!w || !w.HYPE || !w.HYPE.documents) {
                if (!silent) window.postMessage({ type: 'CB_ANSWERS_EXTRACTED', success: false, error: 'No Hype document found' }, '*');
                return { success: false };
            }

            const results = {};
            const offsets = {};
            const formulas = []; // To store detected patterns

            for (let docKey in w.HYPE.documents) {
                const d = w.HYPE.documents[docKey];
                const fns = d.functions();

                const patterns = [
                    /var\s+QAList\s*=\s*([^;]+);/,
                    /var\s+Answers\s*=\s*([^;]+);/,
                    /var\s+AnswerKey\s*=\s*([^;]+);/,
                    /var\s+correctAnswers\s*=\s*([^;]+);/,
                    /var\s+CAarrayList\s*=\s*([^;]+);/
                ];

                // Regex for offset detection (e.g., parseInt(selectedQuestion) - 9)
                const offsetRegex = /selectedQuestion\)\s*-\s*(\d+)/;

                for (let name in fns) {
                    const src = fns[name].toString();

                    // Check for offset
                    const offsetMatch = src.match(offsetRegex);
                    if (offsetMatch) {
                        offsets[`${docKey}_${name}`] = parseInt(offsetMatch[1]);
                    }

                    for (let regex of patterns) {
                        const match = src.match(regex);
                        if (match) {
                            try {
                                let cleanStr = match[1].trim().replace(/\\"/g, '"');
                                let data = new Function(`return ${cleanStr}`)();
                                results[`${docKey}_${name}`] = data;

                                // SELF-EVOLVE: Register this pattern
                                const arrayName = regex.toString().match(/var\s+(\w+)/)[1];
                                const off = offsets[`${docKey}_${name}`] || 0;
                                formulas.push({
                                    id: `${docKey}_${name}_${arrayName}`,
                                    formula: `${arrayName}[selectedQuestion - ${off}]`,
                                    arrayName: arrayName,
                                    offset: off,
                                    fn: name
                                });
                                break;
                            } catch (err) {
                                results[`${docKey}_${name}`] = "Error parsing: " + match[1];
                            }
                        }
                    }
                }
            }

            // Current state detection
            const pickedGroup = w.pickedGroup;
            const selectedQuestion = w.selectedQuestion;
            let activeIndex = (typeof pickedGroup !== 'undefined') ? pickedGroup : selectedQuestion;

            if (Object.keys(results).length > 0) {
                const summary = {};
                for (let k in results) {
                    summary[k] = Array.isArray(results[k]) ? `${results[k].length} answers` : (typeof results[k] === 'string' ? results[k].substring(0, 20) + '...' : 'Data object');
                }
                if (!silent) logEvent(`🧠 Juicy: Extracted ${Object.keys(results).length} sets`, 'success', { summary, results, formulas });

                // Store formulas globally for the fill loop to use
                w.pcFastSmartFormulas = formulas;

                const response = { type: 'CB_ANSWERS_EXTRACTED', success: true, answers: results, offsets: offsets, activeIndex: activeIndex, formulas: formulas };
                if (!silent) window.postMessage(response, '*');
                return response;
            } else {
                if (!silent) logEvent('No answer sets found', 'warning');
                const response = { type: 'CB_ANSWERS_EXTRACTED', success: false, error: 'No answer sets found.' };
                if (!silent) window.postMessage(response, '*');
                return response;
            }
        } catch (e) {
            if (!silent) logEvent('Extraction failed: ' + e.message, 'error');
            const response = { type: 'CB_ANSWERS_EXTRACTED', success: false, error: e.message };
            if (!silent) window.postMessage(response, '*');
            return response;
        }
    }

    // ==================== LIVE ACTIVITY DATA HELPER ====================
    function getLiveActivityData() {
        try {
            const iframe = document.querySelector('iframe#interactiveIframe');
            const w = iframe ? iframe.contentWindow : window;
            if (!w) return null;

            const data = {
                question: w.selectedQuestion || '?',
                group: w.pickedGroup !== undefined ? w.pickedGroup : '?',
                progress: Array.isArray(w.progressLevelList) ? w.progressLevelList.join('') : '?',
                isHype: !!(w.HYPE && w.HYPE.documents)
            };

            // Try to find if any large arrays are present
            let maxArrSize = 0;
            for (let k in w) {
                try {
                    if (Array.isArray(w[k]) && (k.toLowerCase().includes('list') || k.toLowerCase().includes('array')) && w[k].length > maxArrSize) {
                        maxArrSize = w[k].length;
                        data.mainList = k;
                        data.listSize = maxArrSize;
                    }
                } catch (e) { }
            }

            return data;
        } catch (e) { return null; }
    }

    // ==================== ACTIVITY DIAGNOSTIC (V2) ====================
    function runDiagnostic() {
        try {
            const iframe = document.querySelector('iframe#interactiveIframe');
            const w = iframe ? iframe.contentWindow : window;
            if (!w || !w.HYPE || !w.HYPE.documents) return null;

            const lines = [];
            const dataReport = {
                globals: {},
                hypeDocs: {},
                smartFormulas: []
            };

            lines.push('=== PC Fast Activity Diagnostic V3.0 (Self-Evolving) ===');
            lines.push(`URL: ${window.location.href}`);
            lines.push(`Time: ${new Date().toISOString()}`);
            lines.push('');

            // 1. Enhanced Window Global Search
            lines.push('--- Significant Globals ---');
            for (let key in w) {
                try {
                    const val = w[key];
                    const lowerKey = key.toLowerCase();
                    const isList = lowerKey.includes('list') || lowerKey.includes('array') || lowerKey.includes('answer') || lowerKey.includes('ca') || lowerKey.includes('qa');
                    const isInterestingArray = Array.isArray(val) && (val.length > 3 || isList);
                    const isLevelVar = ['userlevel', 'selectedQuestion', 'pickedGroup', 'progressLevelList'].includes(key);

                    if (isInterestingArray || isLevelVar) {
                        const valStr = JSON.stringify(val);
                        lines.push(`${key}: ${valStr.substring(0, 1000)}${valStr.length > 1000 ? '...' : ''}`);
                        dataReport.globals[key] = val;
                    }
                } catch (e) { }
            }
            lines.push('');

            // 2. HYPE documents & Pattern Recognition
            for (let docKey in w.HYPE.documents) {
                lines.push(`--- HYPE Doc: ${docKey} ---`);
                const d = w.HYPE.documents[docKey];
                const fns = d.functions();
                dataReport.hypeDocs[docKey] = { functions: {}, elementInventory: {} };

                for (let name in fns) {
                    const src = fns[name].toString();

                    // SELF-EVOLVE PATTERN: Array access via selectedQuestion
                    const arrayMatch = src.match(/var\s+(\w+)\s*=\s*(\[[^\]]+\]);/);
                    const indexMatch = src.match(/selectedQuestion\)\s*-\s*(\d+)/);

                    if (arrayMatch) {
                        const arrName = arrayMatch[1];
                        const offset = indexMatch ? parseInt(indexMatch[1]) : 0;
                        const formula = `${arrName}[selectedQuestion - ${offset}]`;

                        dataReport.smartFormulas.push({
                            doc: docKey,
                            fn: name,
                            array: arrName,
                            offset: offset,
                            formula: formula
                        });

                        lines.push(`[💡 SMART PATTERN] Detected formula in ${name}: ${formula}`);
                    }

                    // Standard Capture
                    const CAPTURE_KEYWORDS = ['evaluate', 'check', 'QAList', 'CAarrayList', 'AnswerKey', 'correctAnswer'];
                    if (CAPTURE_KEYWORDS.some(k => src.includes(k))) {
                        dataReport.hypeDocs[docKey].functions[name] = src;
                    }
                }

                // Element Probe
                const probeIds = ['quantity1', 'A1SRA', 'SR1', 'locnEdit', 'SR'];
                probeIds.forEach(id => {
                    const el = d.getElementById(id);
                    if (el) {
                        lines.push(`#${id}: innerHTML="${el.innerHTML}"`);
                        dataReport.hypeDocs[docKey].elementInventory[id] = el.innerHTML;
                    }
                });
            }

            lines.push('');
            lines.push('=== END DIAGNOSTIC V3.0 ===');

            const report = lines.join('\n');
            logEvent('🔬 Smart Diagnostic V3.0 generated', 'system');

            return { report, data: dataReport };
        } catch (e) {
            logEvent('Diagnostic failed: ' + e.message, 'error');
            return null;
        }
    }

    // ==================== NAME THAT HARMONIC (STRINGS) SOLVER ====================
    function solveNameThatHarmonic(w, d) {
        try {
            const docKeys = Object.keys(w.HYPE.documents);
            if (!docKeys.some(k => k.toLowerCase().includes('namethatharmonic'))) return false;

            const selectedQuestion = parseInt(w.selectedQuestion);
            if (isNaN(selectedQuestion)) return false;

            // Full 36-entry answer list (all levels, indexed by selectedQuestion - 1)
            const CAList = [1, 2, 3, 4, 5, 6, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 1, 1, 1, 3, 3, 3, 4, 4, 4, 5, 5, 5];
            const idx = selectedQuestion - 1;
            if (idx < 0 || idx >= CAList.length) return false;
            const answer = String(CAList[idx]);

            const fns = d.functions();

            // Check locnEdit (typed answer field) and SR ( grader check field)
            const locnEdit = d.getElementById('locnEdit');
            const graderSR = d.getElementById('SR');

            const currentVal = (locnEdit ? locnEdit.innerHTML : '') || (graderSR ? graderSR.innerHTML : '');
            if (currentVal === answer) return false; // already correct

            if (locnEdit) locnEdit.innerHTML = answer;
            if (graderSR) graderSR.innerHTML = answer;

            logEvent(`🎵 NameThatHarmonic Q${selectedQuestion}: answer=${answer}`, 'success');
            if (fns.evaluate1) setTimeout(() => { try { fns.evaluate1(d, null, null); } catch (e) { } }, 300);
            return true;
        } catch (e) {
            logEvent('NameThatHarmonic solver error: ' + e.message, 'error');
            return false;
        }
    }

    // ==================== SPECTRUM SOLVER (COMPREHENSIVE) ====================
    function solveSpectrum(w, d) {
        try {
            const docKeys = Object.keys(w.HYPE.documents);
            if (!docKeys.some(k => k.toLowerCase().includes('spectrum'))) return false;

            const selectedQuestion = w.selectedQuestion;
            const qType = w.questionType; // "1" for Ranking, "2" for Selection
            const fns = d.functions();

            // Mode 1: Ranking Task (Order 3 regions)
            if (qType === "1" || (!qType && d.getElementById('FirstWaveType'))) {
                const theQItemNumber = parseInt(selectedQuestion) - 1;
                const QAAList = ["132", "132", "231", "213", "312", "321", "132", "321", "213", "1010", "111", "1212", "1313", "1414", "1515", "1616", "1717", "1818", "312", "321", "213", "231", "213", "132", "132", "213", "132", "2828", "2929", "3030", "3131", "3232", "333", "3434", "3535", "3636"];
                const answer = QAAList[theQItemNumber];
                if (!answer || answer.length !== 3) return false;

                const orderList = ["Smallest", "Middlest", "Greatest"];
                const firstRank = orderList[parseInt(answer[0]) - 1];
                const secondRank = orderList[parseInt(answer[1]) - 1];
                const thirdRank = orderList[parseInt(answer[2]) - 1];

                const firstEl = d.getElementById('FirstWaveType');
                const secondEl = d.getElementById('SecondWaveType');
                const thirdEl = d.getElementById('ThirdWaveType');

                if (firstEl && firstEl.innerHTML === firstRank &&
                    secondEl && secondEl.innerHTML === secondRank &&
                    thirdEl && thirdEl.innerHTML === thirdRank) return false;

                if (firstEl) firstEl.innerHTML = firstRank;
                if (secondEl) secondEl.innerHTML = secondRank;
                if (thirdEl) thirdEl.innerHTML = thirdRank;

                logEvent(`🌈 Spectrum Ranking Q${selectedQuestion}: ${firstRank}, ${secondRank}, ${thirdRank}`, 'success');
                if (fns.evaluateQT1) setTimeout(() => fns.evaluateQT1(d, null, null), 300);
                return true;
            }

            // Mode 2: Selection Task (Multi-choice)
            if ((qType === "2" || (!qType && w.QAList)) && w.QAList) {
                const qa = w.QAList;
                const sr = w.SRList;
                if (!qa || !sr) return false;

                // Sync SRList with QAList
                let changed = false;
                for (let i = 0; i < qa.length; i++) {
                    if (sr[i] !== qa[i]) {
                        sr[i] = qa[i];
                        changed = true;
                    }
                }

                if (!changed) return false;

                logEvent(`🌈 Spectrum Selection Q${selectedQuestion}: Checked ${qa.filter(x => x === 1).length} items`, 'success');
                if (fns.evaluate2) setTimeout(() => fns.evaluate2(d, null, null), 300);
                return true;
            }

            return false;
        } catch (e) {
            logEvent('Spectrum solver error: ' + e.message, 'error');
            return false;
        }
    }

    // ==================== FLOATING WIDGET ====================

    let widgetEl = null;
    let isDragging = false;
    let isMinimized = false;
    let dragOffsetX = 0, dragOffsetY = 0;

    function createWidget() {
        if (widgetEl) return;

        // Prevent widget from loading inside iframes or on unauthorized domains
        if (window !== window.top || !shouldRunOnDomain()) return;

        // If body isn't ready yet, wait an additional 100ms
        if (!document.body) {
            setTimeout(createWidget, 100);
            return;
        }

        const widget = document.createElement('div');
        widget.id = 'cbhelper-widget';
        widget.innerHTML = `
            <style>
                #cbhelper-widget {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 2147483647;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                #cbhelper-widget * { box-sizing: border-box; margin: 0; padding: 0; }

                .cbh-panel {
                    width: 220px;
                    background: rgba(15, 23, 42, 0.92);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 14px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(124, 58, 237, 0.1);
                    color: #f1f5f9;
                    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                    transform-origin: bottom right;
                }

                .cbh-panel.minimized {
                    width: auto;
                    padding: 0;
                    background: transparent;
                    backdrop-filter: none;
                    border: none;
                    box-shadow: none;
                }

                .cbh-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: grab;
                    margin-bottom: 12px;
                    user-select: none;
                }
                .cbh-header:active { cursor: grabbing; }
                .cbh-panel.minimized .cbh-header { margin-bottom: 0; }

                .cbh-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .cbh-logo {
                    width: 28px; height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, rgba(124,58,237,0.4), rgba(236,72,153,0.3));
                    border-radius: 8px;
                    font-size: 0.85rem;
                }

                .cbh-title {
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: -0.01em;
                }

                .cbh-panel.minimized .cbh-title,
                .cbh-panel.minimized .cbh-body { display: none; }

                .cbh-controls { display: flex; gap: 4px; }

                .cbh-ctrl-btn {
                    width: 22px; height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    background: rgba(255,255,255,0.06);
                    border-radius: 6px;
                    color: #94a3b8;
                    font-size: 0.65rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .cbh-ctrl-btn:hover {
                    background: rgba(255,255,255,0.12);
                    color: white;
                }

                .cbh-body { display: flex; flex-direction: column; gap: 8px; }

                .cbh-status-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 10px;
                    background: rgba(255,255,255,0.04);
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.06);
                }

                .cbh-status-label { font-size: 0.68rem; color: #94a3b8; }

                .cbh-status-val {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.68rem;
                    font-weight: 600;
                }

                .cbh-dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: #34d399;
                    box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
                    animation: cbh-pulse 2s ease-in-out infinite;
                }
                .cbh-dot.idle { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.5); }
                .cbh-dot.done { background: #818cf8; box-shadow: 0 0 6px rgba(129,140,248,0.5); animation: none; }

                .cbh-live-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 8px 10px;
                    background: rgba(124, 58, 237, 0.08);
                    border-radius: 10px;
                    border: 1px solid rgba(124, 58, 237, 0.15);
                    margin-bottom: 4px;
                }
                .cbh-live-label { font-size: 0.6rem; color: #a78bfa; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
                .cbh-live-content { font-size: 0.68rem; color: #f1f5f9; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                @keyframes cbh-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                .cbh-action-btn {
                    width: 100%;
                    padding: 9px;
                    border: none;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #7c3aed, #a855f7);
                    color: white;
                    font-family: inherit;
                    font-size: 0.72rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 10px rgba(124,58,237,0.25);
                }
                .cbh-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(124,58,237,0.35);
                }
                .cbh-action-btn.done {
                    background: linear-gradient(135deg, #059669, #34d399);
                }

                .cbh-action-btn.secondary {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                    margin-top: 4px;
                }
                .cbh-action-btn.secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .cbh-sol-panel {
                    margin-top: 8px;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .cbh-sol-panel .cbh-sol-list {
                    flex: 1;
                    overflow-y: auto;
                    min-height: 0;
                }
                .cbh-sol-panel.hidden { display: none; }
                .cbh-sol-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
                .cbh-sol-header span { font-size: 0.65rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; }
                .cbh-sol-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.75rem; }
                .cbh-sol-list { display: flex; flex-direction: column; gap: 6px; }
                .cbh-sol-item { font-size: 0.65rem; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid transparent; transition: all 0.2s; }
                .cbh-sol-item.cbh-active {
                    background: rgba(124, 58, 237, 0.15);
                    border-color: rgba(124, 58, 237, 0.4);
                    box-shadow: 0 0 12px rgba(124, 58, 237, 0.1);
                }
                .cbh-sol-name { color: #94a3b8; display: block; margin-bottom: 2px; }
                .cbh-sol-item.cbh-active .cbh-sol-name { color: #fbbf24; font-weight: 800; }
                .cbh-sol-val { color: #f1f5f9; word-break: break-all; font-family: monospace; }

                .cbh-resize-handle {
                    position: absolute;
                    right: 4px;
                    bottom: 4px;
                    width: 12px;
                    height: 12px;
                    cursor: nwse-resize;
                    display: flex;
                    align-items: flex-end;
                    justify-content: flex-end;
                    opacity: 0.4;
                    transition: opacity 0.2s;
                }
                .cbh-resize-handle:hover { opacity: 1; }
                .cbh-resize-handle svg { width: 8px; height: 8px; color: white; }

                /* Hide scrollbars but keep functionality */
                .cbh-body::-webkit-scrollbar { width: 4px; }
                .cbh-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
            </style>
            <div class="cbh-panel ${localStorage.getItem('cbh_collapsed') === 'true' ? 'collapsed' : ''}" id="cbh-panel">
                <div class="cbh-collapsed-icon">🎮</div>
                <div class="cbh-header" id="cbh-header">
                    <div class="cbh-brand">
                        <div class="cbh-logo">🎮</div>
                        <span class="cbh-title">PC Fast</span>
                    </div>
                    <div class="cbh-controls">
                        <button class="cbh-ctrl-btn" id="cbh-minimize" title="Minimize">─</button>
                        <button class="cbh-ctrl-btn" id="cbh-close" title="Hide">✕</button>
                    </div>
                </div>
                <div class="cbh-body">
                    <div class="cbh-status-row">
                        <span class="cbh-status-label">Status</span>
                        <span class="cbh-status-val">
                            <span class="cbh-dot" id="cbh-dot"></span>
                            <span id="cbh-status-text">Monitoring</span>
                        </span>
                    </div>
                    <div class="cbh-live-row" id="cbh-live-data">
                        <span class="cbh-live-label">📡 Live Scan</span>
                        <span class="cbh-live-content" id="cbh-live-content">Waiting...</span>
                    </div>
                    <button class="cbh-action-btn" id="cbh-fill-btn">⚡ Fill Tasks</button>
                    <div style="display: flex; gap: 6px;">
                        <button class="cbh-action-btn secondary" id="cbh-sol-btn" title="View Solutions">💡 Sol</button>
                        <button class="cbh-action-btn secondary" id="cbh-logs-btn" title="Download Logs">📜 Logs</button>
                    </div>
                    <button class="cbh-action-btn secondary" id="cbh-scan-btn" title="Scan activity & copy report to clipboard">🔬 Scan Activity</button>
                    <div id="cbh-sol-panel" class="cbh-sol-panel hidden">
                        <div class="cbh-sol-header">
                            <span>Solutions</span>
                            <button id="cbh-sol-close" class="cbh-sol-close">✕</button>
                        </div>
                        <div id="cbh-sol-list" class="cbh-sol-list"></div>
                    </div>
                </div>
                <div class="cbh-resize-handle" id="cbh-resize">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M22 22L12 12M22 16l-6 6M16 22l6-6"></path></svg>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        widgetEl = widget;

        // Wire up events
        const panel = widget.querySelector('#cbh-panel');
        const header = widget.querySelector('#cbh-header');
        const minimizeBtn = widget.querySelector('#cbh-minimize');
        const closeBtn = widget.querySelector('#cbh-close');
        const fillBtn = widget.querySelector('#cbh-fill-btn');
        const resizeHandle = widget.querySelector('#cbh-resize');

        let isResizing = false;

        // Boundary protection function
        function ensureInViewport() {
            const rect = widget.getBoundingClientRect();
            let newX = rect.left;
            let newY = rect.top;

            if (rect.right > window.innerWidth) newX = window.innerWidth - rect.width - 24;
            if (rect.bottom > window.innerHeight) newY = window.innerHeight - rect.height - 24;
            if (rect.left < 0) newX = 24;
            if (rect.top < 0) newY = 24;

            if (newX !== rect.left || newY !== rect.top) {
                widget.style.left = newX + 'px';
                widget.style.top = newY + 'px';
                widget.style.right = 'auto';
                widget.style.bottom = 'auto';
                localStorage.setItem('cbh_x', newX);
                localStorage.setItem('cbh_y', newY);
            }
        }

        // Restore position 
        const savedX = localStorage.getItem('cbh_x');
        const savedY = localStorage.getItem('cbh_y');
        if (savedX && savedY) {
            widget.style.left = savedX + 'px';
            widget.style.top = savedY + 'px';
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
            setTimeout(ensureInViewport, 500);
        }

        // Resize
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            panel.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });

        // Drag & Collapse Toggle
        let dragStartTime = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.cbh-ctrl-btn') || e.target.closest('#cbh-resize')) return;
            isDragging = true;
            dragStartTime = Date.now();
            const rect = widget.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            widget.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const rect = panel.getBoundingClientRect();
                const newWidth = e.clientX - rect.left;
                const newHeight = e.clientY - rect.top;
                panel.style.width = Math.max(180, newWidth) + 'px';
                panel.style.height = Math.max(100, newHeight) + 'px';
            } else if (isDragging) {
                widget.style.left = (e.clientX - dragOffsetX) + 'px';
                widget.style.top = (e.clientY - dragOffsetY) + 'px';
                widget.style.right = 'auto';
                widget.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                panel.classList.remove('resizing');
                localStorage.setItem('cbh_width', panel.style.width);
                localStorage.setItem('cbh_height', panel.style.height);
            }
            if (isDragging) {
                isDragging = false;
                widget.style.transition = '';
                localStorage.setItem('cbh_x', widget.style.left);
                localStorage.setItem('cbh_y', widget.style.top);
                ensureInViewport();

                // If it was a quick click and collapsed, expand it
                const duration = Date.now() - dragStartTime;
                if (duration < 200 && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    localStorage.setItem('cbh_collapsed', 'false');
                }
            }
        });

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.add('collapsed');
            localStorage.setItem('cbh_collapsed', 'true');
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            widget.style.display = 'none';
            localStorage.setItem('cbhelper_showWidget', 'false');
        });

        fillBtn.addEventListener('click', () => {
            const success = fillProgress();
            if (success) {
                fillBtn.textContent = '✅ Done!';
                fillBtn.classList.add('done');
                setTimeout(() => { fillBtn.textContent = '⚡ Fill Tasks'; fillBtn.classList.remove('done'); }, 2000);
            } else {
                fillBtn.textContent = '⏳ Not ready yet';
                setTimeout(() => { fillBtn.textContent = '⚡ Fill Tasks'; }, 2000);
            }
        });

        const solBtn = widget.querySelector('#cbh-sol-btn');
        const logsBtn = widget.querySelector('#cbh-logs-btn');
        const scanBtn = widget.querySelector('#cbh-scan-btn');
        const solPanel = widget.querySelector('#cbh-sol-panel');
        const solList = widget.querySelector('#cbh-sol-list');
        const solClose = widget.querySelector('#cbh-sol-close');

        scanBtn.addEventListener('click', () => {
            const diag = runDiagnostic();
            if (!diag) {
                scanBtn.textContent = '❌ No HYPE found';
                setTimeout(() => { scanBtn.textContent = '🔬 Scan Activity'; }, 2000);
                return;
            }
            navigator.clipboard.writeText(diag.report).then(() => {
                scanBtn.textContent = '📋 Copied!';
                setTimeout(() => { scanBtn.textContent = '🔬 Scan Activity'; }, 2500);
            }).catch(() => {
                // Fallback: show in console
                console.log('PCF DIAGNOSTIC:\n' + diag.report);
                scanBtn.textContent = '📜 See Console';
                setTimeout(() => { scanBtn.textContent = '🔬 Scan Activity'; }, 2500);
            });
        });

        solBtn.addEventListener('click', () => {
            extractHypeAnswers();
        });

        solClose.addEventListener('click', () => {
            solPanel.classList.add('hidden');
        });

        logsBtn.addEventListener('click', () => {
            try {
                const logs = JSON.parse(localStorage.getItem('pcf_logs') || '[]');
                if (logs.length === 0) {
                    logEvent('Widget download requested but no logs found', 'warning');
                    return;
                }

                const logText = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
                const blob = new Blob([logText], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pcf_logs_${new Date().toISOString().substring(0, 19).replace(/[:]/g, '-')}.txt`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                logEvent('Logs downloaded via floating widget', 'success');
            } catch (e) {
                logEvent('Widget log download failed: ' + e.message, 'error');
            }
        });

        // Listen for answers specifically for the widget
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'CB_ANSWERS_EXTRACTED' && event.data.success) {
                renderWidgetSolutions(event.data.answers, event.data.activeIndex);
                solPanel.classList.remove('hidden');
            }
        });

        function renderWidgetSolutions(answers, activeIndex) {
            if (!solList) return;
            solList.innerHTML = '';
            for (const [name, value] of Object.entries(answers)) {
                // Header for the answer set
                const headerItem = document.createElement('div');
                headerItem.style = "font-size: 0.55rem; color: #475569; margin: 4px 0; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;";
                headerItem.textContent = `Set: ${name}`;
                solList.appendChild(headerItem);

                if (Array.isArray(value)) {
                    value.forEach((val, idx) => {
                        const item = document.createElement('div');
                        item.className = 'cbh-sol-item';
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        item.style.justifyContent = 'space-between';
                        if (idx === activeIndex) item.classList.add('cbh-active');

                        const details = document.createElement('div');
                        details.style.flex = '1';
                        details.style.minWidth = '0';

                        const label = document.createElement('span');
                        label.className = 'cbh-sol-name';
                        label.textContent = idx === activeIndex ? `🎯 MISSION #${idx + 1}` : `Mission #${idx + 1}`;

                        const valEl = document.createElement('span');
                        valEl.className = 'cbh-sol-val';
                        const displayVal = Array.isArray(val) ? `[${val.join(', ')}]` : String(val);
                        valEl.textContent = displayVal;

                        details.appendChild(label);
                        details.appendChild(valEl);
                        item.appendChild(details);

                        // Copy Button for Widget
                        const copyBtn = document.createElement('button');
                        copyBtn.style = "background: rgba(255,255,255,0.05); border: none; color: #64748b; padding: 4px; border-radius: 4px; cursor: pointer; margin-left: 6px; flex-shrink: 0;";
                        copyBtn.innerHTML = `📋`;
                        copyBtn.title = "Copy answer";
                        copyBtn.onclick = () => {
                            const textToCopy = Array.isArray(val) ? val.join(',') : String(val);
                            navigator.clipboard.writeText(textToCopy);
                            copyBtn.textContent = "✅";
                            setTimeout(() => copyBtn.textContent = "📋", 1000);
                        };
                        item.appendChild(copyBtn);

                        solList.appendChild(item);

                        // If active, scroll into view
                        if (idx === activeIndex) {
                            setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                        }
                    });
                } else {
                    const item = document.createElement('div');
                    item.className = 'cbh-sol-item';
                    const valEl = document.createElement('span');
                    valEl.className = 'cbh-sol-val';
                    valEl.textContent = value;
                    item.appendChild(valEl);
                    solList.appendChild(item);
                }
            }
        }

        function updateWidgetLiveData() {
            const liveContent = widget.querySelector('#cbh-live-content');
            if (!liveContent) return;

            const data = getLiveActivityData();
            if (!data) {
                liveContent.textContent = 'Searching...';
                return;
            }

            let summary = `Q:${data.question} | G:${data.group} | P:${data.progress}`;
            if (data.mainList) {
                summary += ` | ${data.mainList}[${data.listSize}]`;
            }

            if (liveContent.textContent !== summary) {
                liveContent.textContent = summary;
                liveContent.style.color = '#34d399';
                setTimeout(() => { liveContent.style.color = '#f1f5f9'; }, 500);
            }
        }

        // Start live update loop
        const liveUpdateInterval = setInterval(updateWidgetLiveData, 2000);

        // Clean up interval if widget is removed (unlikely in this extension but good practice)
        widget.addEventListener('remove', () => clearInterval(liveUpdateInterval));
    }

    function updateWidgetStatus(filled) {
        if (!widgetEl) return;
        const dot = widgetEl.querySelector('#cbh-dot');
        const text = widgetEl.querySelector('#cbh-status-text');
        if (filled) {
            dot.className = 'cbh-dot done';
            text.textContent = 'Filled ✓';
        }
    }

    function toggleWidget(show) {
        if (show) {
            if (!widgetEl) createWidget();
            else widgetEl.style.display = '';
        } else {
            if (widgetEl) widgetEl.style.display = 'none';
        }
    }

    // Initialize widget
    if (isWidgetEnabled() && shouldRunOnDomain()) {
        setTimeout(createWidget, 800);
    }

    // Expose diagnostic for popup access
    window.pcFastRunDiagnostic = runDiagnostic;
})();
