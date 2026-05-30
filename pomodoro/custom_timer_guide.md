# Custom Pomodoro Timer Development Guide

This guide provides developers and AI coding assistants with instructions, guidelines, and a complete code template to design and build custom Pomodoro Timer pages for the Taskflow application.

---

## 1. Core Specifications & Integration

Taskflow loads the active Pomodoro Timer dynamically using an `<iframe>` nested inside the main container backface card (`.clsPomodoroContainer`). 

* **Dimensions**: The timer must stretch to fill its window container: `width: 100%; height: 100%`.
* **Scrollbars**: Your custom timer should hide scrollbars (`overflow: hidden;`) on the `body` element to avoid ugly scroll bars within the Taskflow card.
* **Themes**: The timer should use transparent or semi-transparent backgrounds so that any active background animation or glassmorphism style on the parent page peaks through beautifully.
* **Mobile Responsiveness**: Design layouts utilizing relative units (`rem`, `vh`, `vw`, `%`) to ensure text, buttons, and graphics scale elegantly on mobile screens (portrait formats).

---

## 2. Interactive UX Design Guidelines

To create a premium, mobile-app-like experience, custom timers should implement:
1. **Direct Value Editing**: Let users double-click or click directly on the time duration text (or input) to type in a custom value.
2. **Smooth Sliders**: Provide range sliders (`<input type="range">`) to let users easily drag and adjust time durations.
3. **Adjustment Arrows**: Include tap-friendly adjustment buttons (`+` / `-`) for quick incremental modifications.
4. **Touch Targets**: Keep all buttons and interactive elements at a minimum size of `48px x 48px` to ensure comfortable mobile navigation.

---

## 3. Boilerplate Skeleton Template

Save the code below as a single self-contained HTML file (e.g., `pomodoro_custom_variant.html`) inside the `pomodoro/` folder.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modular Pomodoro Template</title>
    <style>
        /* ----------------------------------------------------
           CSS STYLING SYSTEM
           ---------------------------------------------------- */
        :root {
            /* Premium color palette */
            --color-bg-gradient: linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(10, 10, 15, 0.98));
            --color-primary: #ff5e62;     /* Work state color */
            --color-break: #4ca1af;       /* Break state color */
            --color-text: #ffffff;
            --color-text-muted: rgba(255, 255, 255, 0.6);
            --color-card: rgba(255, 255, 255, 0.05);
            --color-border: rgba(255, 255, 255, 0.1);
        }

        /* Basic CSS Reset & Scroll Lock */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        body {
            background: var(--color-bg-gradient);
            color: var(--color-text);
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Mobile Friendly Centered Layout App Card */
        .timer-card {
            width: 90%;
            max-width: 380px;
            padding: 24px;
            background: var(--color-card);
            border: 1px solid var(--color-border);
            border-radius: 24px;
            backdrop-filter: blur(15px);
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        /* Status Badge */
        .status-badge {
            align-self: center;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            background: rgba(255, 94, 98, 0.15);
            color: var(--color-primary);
            border: 1px solid rgba(255, 94, 98, 0.2);
            transition: all 0.3s ease;
        }

        .status-badge.on-break {
            background: rgba(76, 161, 175, 0.15);
            color: var(--color-break);
            border: 1px solid rgba(76, 161, 175, 0.2);
        }

        /* Main Time Display */
        .time-display {
            font-size: 4.5rem;
            font-weight: 700;
            letter-spacing: -1px;
            line-height: 1;
            margin: 10px 0;
            font-variant-numeric: tabular-nums;
            cursor: pointer;
            user-select: none;
            transition: transform 0.2s ease;
        }

        .time-display:active {
            transform: scale(0.95);
        }

        /* Time Direct Editor Input */
        .time-input {
            font-size: 4.5rem;
            font-weight: 700;
            width: 100%;
            text-align: center;
            background: transparent;
            color: #fff;
            border: none;
            outline: none;
            display: none;
        }

        /* Adjuster Controls (Sliders & Arrows) */
        .adjuster-section {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 16px;
            padding: 12px;
            border: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .control-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .control-label {
            font-size: 0.9rem;
            color: var(--color-text-muted);
            text-align: left;
            flex-grow: 1;
        }

        /* Tap-Friendly Buttons */
        .btn-adjust {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--color-card);
            border: 1px solid var(--color-border);
            color: #fff;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }

        .btn-adjust:active {
            background: rgba(255, 255, 255, 0.1);
        }

        /* Range Slider */
        .duration-slider {
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.1);
            outline: none;
            accent-color: var(--color-primary);
            cursor: pointer;
        }

        /* Control Trigger Action Bar */
        .action-bar {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 10px;
        }

        .btn-action {
            padding: 12px 28px;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 30px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 110px;
            min-height: 48px; /* Touch friendly */
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn-start {
            background: var(--color-primary);
            color: #fff;
            box-shadow: 0 4px 15px rgba(255, 94, 98, 0.3);
        }

        .btn-start:active {
            transform: scale(0.96);
        }

        .btn-reset {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--color-border);
            color: var(--color-text-muted);
        }

        .btn-reset:hover {
            color: #fff;
        }

        .btn-reset:active {
            transform: scale(0.96);
        }
    </style>
</head>
<body>

    <div class="timer-card">
        <!-- State Header -->
        <div id="statusBadge" class="status-badge">Focus Time</div>

        <!-- Timer Display / Direct Editor -->
        <div class="display-container">
            <div id="timeDisplay" class="time-display" title="Click to edit directly">25:00</div>
            <input type="text" id="timeInput" class="time-input" placeholder="25:00">
        </div>

        <!-- Duration Adjusters Section -->
        <div class="adjuster-section">
            <!-- Work Duration Control -->
            <div class="control-row">
                <span class="control-label">Work: <span id="lblWorkDuration">25</span>m</span>
                <button class="btn-adjust" onclick="adjustDuration('work', -1)">-</button>
                <button class="btn-adjust" onclick="adjustDuration('work', 1)">+</button>
            </div>
            <input type="range" id="sliderWork" class="duration-slider" min="1" max="60" value="25" oninput="updateFromSlider('work', this.value)">

            <!-- Break Duration Control -->
            <div class="control-row">
                <span class="control-label">Break: <span id="lblBreakDuration">5</span>m</span>
                <button class="btn-adjust" onclick="adjustDuration('break', -1)">-</button>
                <button class="btn-adjust" onclick="adjustDuration('break', 1)">+</button>
            </div>
            <input type="range" id="sliderBreak" class="duration-slider" min="1" max="30" value="5" oninput="updateFromSlider('break', this.value)">
        </div>

        <!-- Start / Reset Controls -->
        <div class="action-bar">
            <button id="btnStart" class="btn-action btn-start" onclick="toggleTimer()">Start</button>
            <button id="btnReset" class="btn-action btn-reset" onclick="resetTimer()">Reset</button>
        </div>
    </div>

    <script>
        /* ----------------------------------------------------
           JAVASCRIPT TIMER LOGIC
           ---------------------------------------------------- */
        
        // Settings State variables
        let workDuration = 25 * 60; // 25 minutes in seconds
        let breakDuration = 5 * 60; // 5 minutes in seconds
        
        let timeLeft = workDuration;
        let isRunning = false;
        let isBreakMode = false;
        let timerInterval = null;

        // Elements caching
        const timeDisplay = document.getElementById('timeDisplay');
        const timeInput = document.getElementById('timeInput');
        const statusBadge = document.getElementById('statusBadge');
        const btnStart = document.getElementById('btnStart');
        const lblWorkDuration = document.getElementById('lblWorkDuration');
        const lblBreakDuration = document.getElementById('lblBreakDuration');
        const sliderWork = document.getElementById('sliderWork');
        const sliderBreak = document.getElementById('sliderBreak');

        // Initialize display content
        updateDisplay();

        /**
         * Standard Display Formatter
         */
        function updateDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timeDisplay.textContent = text;
            timeInput.value = text;
        }

        /**
         * Start / Stop Toggle Switch
         */
        function toggleTimer() {
            if (isRunning) {
                clearInterval(timerInterval);
                isRunning = false;
                btnStart.textContent = "Start";
                btnStart.style.background = "var(--color-primary)";
            } else {
                isRunning = true;
                btnStart.textContent = "Pause";
                btnStart.style.background = "#e04e52";
                
                timerInterval = setInterval(() => {
                    if (timeLeft > 0) {
                        timeLeft--;
                        updateDisplay();
                    } else {
                        // Switch between Break and Work states dynamically
                        isBreakMode = !isBreakMode;
                        timeLeft = isBreakMode ? breakDuration : workDuration;
                        
                        // Style updating according to states
                        statusBadge.textContent = isBreakMode ? "Break Time" : "Focus Time";
                        if (isBreakMode) {
                            statusBadge.classList.add('on-break');
                            document.documentElement.style.setProperty('--color-primary', 'var(--color-break)');
                        } else {
                            statusBadge.classList.remove('on-break');
                            document.documentElement.style.setProperty('--color-primary', '#ff5e62');
                        }

                        // Play simple alert audio chime
                        try {
                            const alertSound = new Audio("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
                            alertSound.volume = 0.5;
                            alertSound.play();
                        } catch (e) { console.log("Audio play deferred"); }

                        updateDisplay();
                    }
                }, 1000);
            }
        }

        /**
         * Reset Timer back to the selected work duration state
         */
        function resetTimer() {
            clearInterval(timerInterval);
            isRunning = false;
            isBreakMode = false;
            timeLeft = workDuration;
            
            statusBadge.textContent = "Focus Time";
            statusBadge.classList.remove('on-break');
            document.documentElement.style.setProperty('--color-primary', '#ff5e62');
            
            btnStart.textContent = "Start";
            btnStart.style.background = "var(--color-primary)";
            
            updateDisplay();
        }

        /**
         * Adjust Duration via Arrow buttons
         */
        function adjustDuration(type, delta) {
            if (isRunning) return; // Prevent modifying active timer loops

            if (type === 'work') {
                let minutes = Math.floor(workDuration / 60) + delta;
                minutes = Math.max(1, Math.min(60, minutes)); // constrain range
                workDuration = minutes * 60;
                lblWorkDuration.textContent = minutes;
                sliderWork.value = minutes;
                if (!isBreakMode) timeLeft = workDuration;
            } else {
                let minutes = Math.floor(breakDuration / 60) + delta;
                minutes = Math.max(1, Math.min(30, minutes)); // constrain range
                breakDuration = minutes * 60;
                lblBreakDuration.textContent = minutes;
                sliderBreak.value = minutes;
                if (isBreakMode) timeLeft = breakDuration;
            }
            updateDisplay();
        }

        /**
         * Adjust Duration via range sliders
         */
        function updateFromSlider(type, val) {
            if (isRunning) return;
            const minutes = parseInt(val, 10);
            if (type === 'work') {
                workDuration = minutes * 60;
                lblWorkDuration.textContent = minutes;
                if (!isBreakMode) timeLeft = workDuration;
            } else {
                breakDuration = minutes * 60;
                lblBreakDuration.textContent = minutes;
                if (isBreakMode) timeLeft = breakDuration;
            }
            updateDisplay();
        }

        /**
         * Inline Direct Entry editing features
         */
        timeDisplay.addEventListener('dblclick', () => {
            if (isRunning) return;
            timeDisplay.style.display = "none";
            timeInput.style.display = "block";
            timeInput.focus();
            timeInput.select();
        });

        timeInput.addEventListener('blur', finalizeDirectEdit);
        timeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finalizeDirectEdit();
            if (e.key === 'Escape') {
                timeInput.style.display = "none";
                timeDisplay.style.display = "block";
            }
        });

        function finalizeDirectEdit() {
            const rawVal = timeInput.value.trim();
            const timeParts = rawVal.split(':');
            
            let minutes = 25;
            let seconds = 0;

            if (timeParts.length === 1) {
                minutes = parseInt(timeParts[0], 10) || 25;
            } else if (timeParts.length >= 2) {
                minutes = parseInt(timeParts[0], 10) || 25;
                seconds = parseInt(timeParts[1], 10) || 0;
            }

            minutes = Math.max(0, Math.min(99, minutes));
            seconds = Math.max(0, Math.min(59, seconds));

            const totalSeconds = (minutes * 60) + seconds;

            if (isBreakMode) {
                breakDuration = totalSeconds;
                lblBreakDuration.textContent = Math.round(minutes);
                sliderBreak.value = Math.round(minutes);
            } else {
                workDuration = totalSeconds;
                lblWorkDuration.textContent = Math.round(minutes);
                sliderWork.value = Math.round(minutes);
            }

            timeLeft = totalSeconds;
            timeInput.style.display = "none";
            timeDisplay.style.display = "block";
            updateDisplay();
        }
    </script>
</body>
</html>
```

---

## 4. Registering Your Custom Timer in Taskflow

Once your new timer is finalized:
1. Save the file into the `pomodoro/` directory.
2. Flip the Taskflow card to the back (click the Hourglass icon).
3. Hover over the **settings/tune** icon next to the audio loop player.
4. Click the `+` button in the revealed menu list.
5. Enter the exact file name (e.g., `pomodoro_custom_variant.html`) and assign it a name.
6. The timer selector dropdown will instantly register and render your custom sub-module!
