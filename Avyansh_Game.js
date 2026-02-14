        const canvas = document.getElementById("game");
        const ctx = canvas.getContext("2d");

        const scoreLabel = document.getElementById("scoreLabel");
        const livesLabel = document.getElementById("livesLabel");
        const levelLabel = document.getElementById("levelLabel");
        const modeLabel = document.getElementById("modeLabel");
        const gameModeLabel = document.getElementById("gameModeLabel");
        const bossLabel = document.getElementById("bossLabel");
        const menuBtn = document.getElementById("menuBtn");
        const backdrop = document.getElementById("backdrop");
        const pauseBtn = document.getElementById("pauseBtn");
        const startBtn = document.getElementById("startBtn");
        const helpText = document.getElementById("helpText");
        const singleBtn = document.getElementById("singleBtn");
        const multiBtn = document.getElementById("multiBtn");
        const hostBtn = document.getElementById("hostBtn");
        const joinBtn = document.getElementById("joinBtn");
        const resetNetBtn = document.getElementById("resetNetBtn");
        const makeOfferBtn = document.getElementById("makeOfferBtn");
        const makeAnswerBtn = document.getElementById("makeAnswerBtn");
        const applyAnswerBtn = document.getElementById("applyAnswerBtn");
        const localSignal = document.getElementById("localSignal");
        const remoteSignal = document.getElementById("remoteSignal");
        const netStatus = document.getElementById("netStatus");
        const copyLocalBtn = document.getElementById("copyLocalBtn");
        const pasteRemoteBtn = document.getElementById("pasteRemoteBtn");
        const localQr = document.getElementById("localQr");
        const remoteQr = document.getElementById("remoteQr");
        const touchButtons = {
            p1Up: document.getElementById("p1Up"),
            p1Left: document.getElementById("p1Left"),
            p1Right: document.getElementById("p1Right"),
            p1Down: document.getElementById("p1Down"),
            p1Shoot: document.getElementById("p1Shoot"),
            p2Up: document.getElementById("p2Up"),
            p2Left: document.getElementById("p2Left"),
            p2Right: document.getElementById("p2Right"),
            p2Down: document.getElementById("p2Down"),
            p2Shoot: document.getElementById("p2Shoot")
        };

        const modeButtons = {
            easy: document.getElementById("easyBtn"),
            medium: document.getElementById("mediumBtn"),
            hard: document.getElementById("hardBtn")
        };

        const skinButtons = {
            avengers: document.getElementById("skinAvengersBtn"),
            dc: document.getElementById("skinDcBtn"),
            random: document.getElementById("skinRandomBtn")
        };

        const difficultyProfiles = {
            easy: { lives: 5, spawnFrames: 76, minSpawnFrames: 34, enemySpeed: 0.88, levelRamp: 1.45, levelEvery: 16 },
            medium: { lives: 3, spawnFrames: 60, minSpawnFrames: 26, enemySpeed: 1, levelRamp: 2.1, levelEvery: 12 },
            hard: { lives: 2, spawnFrames: 46, minSpawnFrames: 20, enemySpeed: 1.18, levelRamp: 2.6, levelEvery: 10 }
        };

        const skinProfiles = {
            avengers: {
                redTeam: "#e63946",
                blueTeam: "#2563eb",
                enemy: "#a855f7",
                boss: "#f59e0b",
                bullet: "#ffd166",
                bossBullet: "#ff9f4a",
                bgTop: "#0f235a",
                bgBottom: "#2e71cd"
            },
            dc: {
                redTeam: "#ff3b30",
                blueTeam: "#1d4ed8",
                enemy: "#10b981",
                boss: "#f97316",
                bullet: "#fde047",
                bossBullet: "#fb923c",
                bgTop: "#0e1b44",
                bgBottom: "#1d4f9f"
            }
        };

        const state = {
            running: false,
            paused: false,
            score: 0,
            lives: 5,
            level: 1,
            difficulty: "easy",
            gameplayMode: null,
            skin: "avengers",
            palette: skinProfiles.avengers,
            stars: [],
            bullets: [],
            enemies: [],
            bossBullets: [],
            boss: null,
            nextBossLevel: 10,
            keys: new Set(),
            spawnTimer: 0,
            bossShotTimer: 0,
            playerHitCooldown: 0
        };

        const rtc = {
            role: null,
            connected: false,
            pc: null,
            dc: null,
            remoteInput: { left: false, right: false, up: false, down: false, shoot: false },
            guestSnapshot: null,
            lastSendAt: 0
        };

        const players = [
            {
                team: "RED",
                x: canvas.width * 0.35,
                y: canvas.height - 70,
                w: 42,
                h: 42,
                speed: 5,
                fireCooldown: 0,
                firing: false,
                key: { left: "a", right: "d", up: "w", down: "s", shoot: "f" },
                singleKey: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", shoot: " " }
            },
            {
                team: "BLUE",
                x: canvas.width * 0.65,
                y: canvas.height - 70,
                w: 42,
                h: 42,
                speed: 5,
                fireCooldown: 0,
                firing: false,
                key: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", shoot: "l" },
                singleKey: { left: "", right: "", up: "", down: "", shoot: "" }
            }
        ];

        const touchInput = {
            p1: { left: false, right: false, up: false, down: false, shoot: false },
            p2: { left: false, right: false, up: false, down: false, shoot: false }
        };

        const iceConfig = {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        };

        function updateNetStatus(text) {
            netStatus.textContent = "ONLINE: " + text;
        }

        function setMenuOpen(open) {
            document.body.classList.toggle("menu-open", open);
        }

        function renderQrFor(targetImg, text) {
            if (!text || !text.trim()) {
                targetImg.removeAttribute("src");
                return;
            }
            const payload = encodeURIComponent(text.trim());
            targetImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + payload;
        }

        function refreshSignalQrs() {
            renderQrFor(localQr, localSignal.value);
            renderQrFor(remoteQr, remoteSignal.value);
        }

        function safeParseSignal(value) {
            try {
                return JSON.parse(value);
            } catch (error) {
                return null;
            }
        }

        function waitForIceComplete(pc) {
            if (pc.iceGatheringState === "complete") {
                return Promise.resolve();
            }
            return new Promise((resolve) => {
                const check = () => {
                    if (pc.iceGatheringState === "complete") {
                        pc.removeEventListener("icegatheringstatechange", check);
                        resolve();
                    }
                };
                pc.addEventListener("icegatheringstatechange", check);
            });
        }

        function closeRtc() {
            if (rtc.dc) {
                rtc.dc.close();
            }
            if (rtc.pc) {
                rtc.pc.close();
            }
            rtc.role = null;
            rtc.connected = false;
            rtc.pc = null;
            rtc.dc = null;
            rtc.remoteInput = { left: false, right: false, up: false, down: false, shoot: false };
            rtc.guestSnapshot = null;
            rtc.lastSendAt = 0;
            updateNetStatus("OFF");
            refreshSignalQrs();
        }

        function sendRtcMessage(payload) {
            if (!rtc.connected || !rtc.dc || rtc.dc.readyState !== "open") return;
            rtc.dc.send(JSON.stringify(payload));
        }

        function applyGuestSnapshot(snapshot) {
            state.running = !!snapshot.running;
            state.paused = !!snapshot.paused;
            state.score = snapshot.score;
            state.lives = snapshot.lives;
            state.level = snapshot.level;
            state.nextBossLevel = snapshot.nextBossLevel;
            state.bullets = snapshot.bullets || [];
            state.enemies = snapshot.enemies || [];
            state.bossBullets = snapshot.bossBullets || [];
            state.boss = snapshot.boss || null;
            if (snapshot.players && snapshot.players[0]) {
                players[0].x = snapshot.players[0].x;
                players[0].y = snapshot.players[0].y;
            }
            if (snapshot.players && snapshot.players[1]) {
                players[1].x = snapshot.players[1].x;
                players[1].y = snapshot.players[1].y;
            }
            refreshHud();
        }

        function onRtcMessage(event) {
            const packet = safeParseSignal(event.data);
            if (!packet || !packet.type) return;

            if (rtc.role === "host" && packet.type === "input") {
                rtc.remoteInput = packet.input || rtc.remoteInput;
                if (packet.command === "start") {
                    resetGame();
                }
                if (packet.command === "pause") {
                    togglePause();
                }
            }

            if (rtc.role === "guest" && packet.type === "state") {
                rtc.guestSnapshot = packet;
                applyGuestSnapshot(packet);
            }
        }

        function setupDataChannel(channel) {
            rtc.dc = channel;
            channel.onopen = () => {
                rtc.connected = true;
                updateNetStatus("CONNECTED (" + rtc.role.toUpperCase() + ")");
            };
            channel.onclose = () => {
                rtc.connected = false;
                updateNetStatus("DISCONNECTED");
            };
            channel.onmessage = onRtcMessage;
        }

        function createPeerConnection(role) {
            closeRtc();
            rtc.role = role;
            rtc.pc = new RTCPeerConnection(iceConfig);
            rtc.pc.onconnectionstatechange = () => {
                if (rtc.pc.connectionState === "failed" || rtc.pc.connectionState === "disconnected") {
                    updateNetStatus("CONNECTION LOST");
                }
            };
            if (role === "guest") {
                rtc.pc.ondatachannel = (event) => {
                    setupDataChannel(event.channel);
                };
            } else {
                setupDataChannel(rtc.pc.createDataChannel("hero-blaster-coop"));
            }
            updateNetStatus(role.toUpperCase() + " READY");
        }

        function randColor() {
            const hue = Math.floor(Math.random() * 360);
            return `hsl(${hue} 88% 62%)`;
        }

        function randomSkinProfile() {
            return {
                redTeam: randColor(),
                blueTeam: randColor(),
                enemy: randColor(),
                boss: randColor(),
                bullet: randColor(),
                bossBullet: randColor(),
                bgTop: randColor(),
                bgBottom: randColor()
            };
        }

        function applySkinCss() {
            document.documentElement.style.setProperty("--bg-top", state.palette.bgTop);
            document.documentElement.style.setProperty("--bg-bottom", state.palette.bgBottom);
            document.documentElement.style.setProperty("--enemy", state.palette.enemy);
            document.documentElement.style.setProperty("--boss", state.palette.boss);
            document.documentElement.style.setProperty("--bullet", state.palette.bullet);
            document.documentElement.style.setProperty("--red-team", state.palette.redTeam);
            document.documentElement.style.setProperty("--blue-team", state.palette.blueTeam);
        }

        function setGameplayMode(mode) {
            if (state.running) return;
            state.gameplayMode = mode;
            singleBtn.classList.toggle("active", mode === "single");
            multiBtn.classList.toggle("active", mode === "multi");
            document.body.classList.toggle("single-mode", mode === "single");
            if (mode === "single") {
                helpText.textContent = "Single: Arrow keys + Space. Start: Enter. Pause: P.";
            } else if (mode === "multi") {
                helpText.textContent = "Multi: Red WASD+F, Blue Arrows+L. Start: Enter. Pause: P.";
            } else {
                helpText.textContent = "Pick SINGLE or MULTI first. Start: Enter. Pause: P.";
            }
            refreshHud();
            draw();
        }

        function getControlsForPlayer(index) {
            return state.gameplayMode === "single" ? players[index].singleKey : players[index].key;
        }

        function playerIsEnabled(index) {
            if (!state.gameplayMode) return false;
            if (state.gameplayMode === "single") return index === 0;
            return true;
        }

        function setSkin(name) {
            if (state.running) return;
            state.skin = name;
            state.palette = name === "random" ? randomSkinProfile() : skinProfiles[name];
            Object.entries(skinButtons).forEach(([key, btn]) => {
                btn.classList.toggle("active", key === name);
            });
            applySkinCss();
            draw();
        }

        function setDifficulty(mode) {
            if (state.running) return;
            state.difficulty = mode;
            Object.entries(modeButtons).forEach(([name, button]) => {
                button.classList.toggle("active", name === mode);
            });
            state.lives = difficultyProfiles[mode].lives;
            refreshHud();
            draw();
        }

        function resetGame() {
            if (!state.gameplayMode) return;
            const profile = difficultyProfiles[state.difficulty];
            state.score = 0;
            state.lives = profile.lives;
            state.level = 1;
            state.bullets = [];
            state.enemies = [];
            state.bossBullets = [];
            state.boss = null;
            state.nextBossLevel = 10;
            state.spawnTimer = 0;
            state.bossShotTimer = 0;
            state.playerHitCooldown = 0;
            state.paused = false;
            pauseBtn.textContent = "PAUSE";

            players[0].x = canvas.width * 0.35;
            players[1].x = canvas.width * 0.65;
            players.forEach((player) => {
                player.y = canvas.height - 70;
                player.fireCooldown = 0;
                player.firing = false;
            });

            state.running = true;
            startBtn.textContent = "RESTART";
            refreshHud();
        }

        function refreshHud() {
            scoreLabel.textContent = "SCORE " + state.score;
            livesLabel.textContent = "LIVES " + state.lives;
            levelLabel.textContent = "LEVEL " + state.level;
            modeLabel.textContent = "MODE " + state.difficulty.toUpperCase();
            gameModeLabel.textContent = state.gameplayMode ? "GAME " + state.gameplayMode.toUpperCase() : "GAME MODE ?";
            if (state.boss) {
                bossLabel.textContent = "BOSS HP " + Math.max(0, state.boss.hp);
            } else {
                bossLabel.textContent = "BOSS L" + state.nextBossLevel;
            }
        }

        function buildStatePacket() {
            return {
                type: "state",
                running: state.running,
                paused: state.paused,
                score: state.score,
                lives: state.lives,
                level: state.level,
                nextBossLevel: state.nextBossLevel,
                bullets: state.bullets,
                enemies: state.enemies,
                bossBullets: state.bossBullets,
                boss: state.boss,
                players: [
                    { x: players[0].x, y: players[0].y },
                    { x: players[1].x, y: players[1].y }
                ]
            };
        }

        function initStars() {
            state.stars = Array.from({ length: 90 }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 0.85 + 0.35
            }));
        }

        function spawnEnemy() {
            const profile = difficultyProfiles[state.difficulty];
            const size = Math.random() * 22 + 24;
            state.enemies.push({
                x: Math.random() * (canvas.width - size),
                y: -size,
                w: size,
                h: size,
                speed: (Math.random() * 1.05 + 1.15 + state.level * 0.16) * profile.enemySpeed
            });
        }

        function spawnBoss(level) {
            const hp = 22 + Math.floor(level * 1.55);
            state.boss = {
                x: canvas.width / 2 - 94,
                y: 28,
                w: 188,
                h: 74,
                hp,
                maxHp: hp,
                speed: 1.65 + level * 0.02,
                dir: 1
            };
            state.enemies = [];
            state.bossBullets = [];
            state.bossShotTimer = 0;
        }

        function shoot(playerIndex) {
            const player = players[playerIndex];
            if (!state.running || state.paused || player.fireCooldown > 0) return;
            state.bullets.push({
                x: player.x + player.w / 2 - 4,
                y: player.y - 8,
                w: 8,
                h: 16,
                speed: 12,
                team: player.team
            });
            player.fireCooldown = 5;
        }

        function collide(a, b) {
            return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        }

        function damageTeam(amount) {
            if (state.playerHitCooldown > 0) return;
            state.lives -= amount;
            state.playerHitCooldown = 35;
        }

        function togglePause() {
            if (!state.running) return;
            state.paused = !state.paused;
            pauseBtn.textContent = state.paused ? "RESUME" : "PAUSE";
        }

        function updatePlayers() {
            players.forEach((player, index) => {
                if (!playerIsEnabled(index)) return;
                const controls = getControlsForPlayer(index);
                const touch = index === 0 ? touchInput.p1 : touchInput.p2;
                const remote = rtc.role === "host" && rtc.connected && index === 1 ? rtc.remoteInput : null;
                if ((controls.left && state.keys.has(controls.left)) || touch.left || (remote && remote.left)) player.x -= player.speed;
                if ((controls.right && state.keys.has(controls.right)) || touch.right || (remote && remote.right)) player.x += player.speed;
                if ((controls.up && state.keys.has(controls.up)) || touch.up || (remote && remote.up)) player.y -= player.speed;
                if ((controls.down && state.keys.has(controls.down)) || touch.down || (remote && remote.down)) player.y += player.speed;

                player.x = Math.max(8, Math.min(canvas.width - player.w - 8, player.x));
                player.y = Math.max(70, Math.min(canvas.height - player.h - 8, player.y));

                player.fireCooldown = Math.max(0, player.fireCooldown - 1);
                if (player.firing || touch.shoot || (remote && remote.shoot)) shoot(index);
            });
        }

        function bindTouchHold(button, onDown, onUp) {
            if (!button) return;
            const handleDown = (event) => {
                event.preventDefault();
                onDown();
                button.classList.add("active");
            };
            const handleUp = () => {
                onUp();
                button.classList.remove("active");
            };

            button.addEventListener("pointerdown", handleDown);
            ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
                button.addEventListener(evt, handleUp);
            });

            button.addEventListener("touchstart", handleDown, { passive: false });
            ["touchend", "touchcancel"].forEach((evt) => {
                button.addEventListener(evt, handleUp, { passive: false });
            });
        }

        function setupTouchControls() {
            bindTouchHold(touchButtons.p1Up, () => { touchInput.p1.up = true; }, () => { touchInput.p1.up = false; });
            bindTouchHold(touchButtons.p1Left, () => { touchInput.p1.left = true; }, () => { touchInput.p1.left = false; });
            bindTouchHold(touchButtons.p1Right, () => { touchInput.p1.right = true; }, () => { touchInput.p1.right = false; });
            bindTouchHold(touchButtons.p1Down, () => { touchInput.p1.down = true; }, () => { touchInput.p1.down = false; });
            bindTouchHold(touchButtons.p1Shoot, () => { touchInput.p1.shoot = true; }, () => { touchInput.p1.shoot = false; });

            bindTouchHold(touchButtons.p2Up, () => { touchInput.p2.up = true; }, () => { touchInput.p2.up = false; });
            bindTouchHold(touchButtons.p2Left, () => { touchInput.p2.left = true; }, () => { touchInput.p2.left = false; });
            bindTouchHold(touchButtons.p2Right, () => { touchInput.p2.right = true; }, () => { touchInput.p2.right = false; });
            bindTouchHold(touchButtons.p2Down, () => { touchInput.p2.down = true; }, () => { touchInput.p2.down = false; });
            bindTouchHold(touchButtons.p2Shoot, () => { touchInput.p2.shoot = true; }, () => { touchInput.p2.shoot = false; });
        }

        function updateBoss() {
            if (!state.boss && state.level >= state.nextBossLevel) {
                spawnBoss(state.level);
            }

            if (!state.boss) return;

            state.boss.x += state.boss.speed * state.boss.dir;
            if (state.boss.x <= 10 || state.boss.x + state.boss.w >= canvas.width - 10) {
                state.boss.dir *= -1;
            }

            state.bossShotTimer += 1;
            if (state.bossShotTimer > 40) {
                state.bossBullets.push({
                    x: state.boss.x + state.boss.w / 2 - 5,
                    y: state.boss.y + state.boss.h - 2,
                    w: 10,
                    h: 18,
                    speed: 5 + state.level * 0.05
                });
                state.bossShotTimer = 0;
            }
        }

        function update() {
            if (rtc.role === "guest" && rtc.connected) {
                const guestControls = getControlsForPlayer(0);
                const guestInput = {
                    left: (guestControls.left && state.keys.has(guestControls.left)) || touchInput.p1.left,
                    right: (guestControls.right && state.keys.has(guestControls.right)) || touchInput.p1.right,
                    up: (guestControls.up && state.keys.has(guestControls.up)) || touchInput.p1.up,
                    down: (guestControls.down && state.keys.has(guestControls.down)) || touchInput.p1.down,
                    shoot: (guestControls.shoot && state.keys.has(guestControls.shoot)) || touchInput.p1.shoot
                };
                const now = performance.now();
                if (now - rtc.lastSendAt > 50) {
                    sendRtcMessage({ type: "input", input: guestInput });
                    rtc.lastSendAt = now;
                }
                return;
            }

            if (!state.running || state.paused) return;

            updatePlayers();

            state.playerHitCooldown = Math.max(0, state.playerHitCooldown - 1);

            state.spawnTimer += 1;
            const profile = difficultyProfiles[state.difficulty];
            const spawnThreshold = Math.max(profile.minSpawnFrames, profile.spawnFrames - state.level * profile.levelRamp);
            if (!state.boss && state.spawnTimer > spawnThreshold) {
                spawnEnemy();
                state.spawnTimer = 0;
            }

            for (const star of state.stars) {
                star.y += star.speed;
                if (star.y > canvas.height) {
                    star.y = -4;
                    star.x = Math.random() * canvas.width;
                }
            }

            state.bullets.forEach((bullet) => {
                bullet.y -= bullet.speed;
            });
            state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.h > 0);

            state.enemies.forEach((enemy) => {
                enemy.y += enemy.speed;
            });

            for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
                const enemy = state.enemies[i];
                if (enemy.y > canvas.height + 20) {
                    state.enemies.splice(i, 1);
                    damageTeam(1);
                }
            }

            for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
                const enemy = state.enemies[i];
                let removed = false;

                for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
                    if (collide(enemy, state.bullets[j])) {
                        state.enemies.splice(i, 1);
                        state.bullets.splice(j, 1);
                        state.score += 1;
                        if (state.score % difficultyProfiles[state.difficulty].levelEvery === 0) state.level += 1;
                        removed = true;
                        break;
                    }
                }
                if (removed) continue;

                for (let p = 0; p < players.length; p += 1) {
                    if (!playerIsEnabled(p)) continue;
                    const player = players[p];
                    if (collide(enemy, player)) {
                        state.enemies.splice(i, 1);
                        damageTeam(1);
                        break;
                    }
                }
            }

            updateBoss();

            state.bossBullets.forEach((bullet) => {
                bullet.y += bullet.speed;
            });
            state.bossBullets = state.bossBullets.filter((bullet) => bullet.y < canvas.height + 30);

            if (state.boss) {
                for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
                    if (collide(state.boss, state.bullets[j])) {
                        state.bullets.splice(j, 1);
                        state.boss.hp -= 1;
                    }
                }

                for (let j = state.bossBullets.length - 1; j >= 0; j -= 1) {
                    for (let p = 0; p < players.length; p += 1) {
                        if (!playerIsEnabled(p)) continue;
                        const player = players[p];
                        if (collide(player, state.bossBullets[j])) {
                            state.bossBullets.splice(j, 1);
                            damageTeam(1);
                            break;
                        }
                    }
                }

                for (let p = 0; p < players.length; p += 1) {
                    if (!playerIsEnabled(p)) continue;
                    const player = players[p];
                    if (collide(player, state.boss)) {
                        damageTeam(1);
                    }
                }

                if (state.boss.hp <= 0) {
                    state.score += 10;
                    state.level += 1;
                    state.boss = null;
                    state.bossBullets = [];
                    state.nextBossLevel += 10;
                }
            }

            if (state.lives <= 0) {
                state.running = false;
                state.paused = false;
                pauseBtn.textContent = "PAUSE";
            }

            refreshHud();

            if (rtc.role === "host" && rtc.connected) {
                const now = performance.now();
                if (now - rtc.lastSendAt > 70) {
                    sendRtcMessage(buildStatePacket());
                    rtc.lastSendAt = now;
                }
            }
        }

        function drawPlayer(player, teamColor) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.fillStyle = teamColor;
            ctx.fillRect(10, 0, 22, 12);
            ctx.fillRect(0, 12, 42, 22);
            ctx.fillRect(8, 34, 10, 8);
            ctx.fillRect(24, 34, 10, 8);
            ctx.fillStyle = "#f8fdff";
            ctx.fillRect(18, 18, 6, 8);
            ctx.restore();
        }

        function drawPausedOverlay() {
            ctx.fillStyle = "rgba(1, 8, 28, 0.66)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = "center";
            ctx.fillStyle = "#ffd449";
            ctx.font = "28px 'Press Start 2P'";
            ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 20);
            ctx.fillStyle = "#e8f8ff";
            ctx.font = "20px 'Baloo 2'";
            ctx.fillText("Press P or Pause to continue", canvas.width / 2, canvas.height / 2 + 18);
        }

        function drawStartGameOverOverlay() {
            ctx.fillStyle = "rgba(1, 8, 28, 0.74)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = "center";
            ctx.fillStyle = "#ffd449";
            ctx.font = "25px 'Press Start 2P'";
            ctx.fillText(state.lives <= 0 ? "GAME OVER" : "HERO BLASTER LEGENDS", canvas.width / 2, canvas.height / 2 - 42);
            ctx.fillStyle = "#e8f8ff";
            ctx.font = "20px 'Baloo 2'";
            if (!state.gameplayMode) {
                ctx.fillText("Choose SINGLE or MULTI first", canvas.width / 2, canvas.height / 2);
                ctx.fillText("Then press Enter to start", canvas.width / 2, canvas.height / 2 + 34);
            } else {
                ctx.fillText("Press Enter to Start", canvas.width / 2, canvas.height / 2);
                ctx.fillText(state.gameplayMode === "single" ? "Single Player Mode" : "Team Red + Blue Mode", canvas.width / 2, canvas.height / 2 + 34);
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#0a173f";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (const star of state.stars) {
                ctx.fillStyle = "rgba(201, 238, 255, 0.9)";
                ctx.fillRect(star.x, star.y, star.size, star.size);
            }

            state.bullets.forEach((bullet) => {
                ctx.fillStyle = state.palette.bullet;
                ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
            });

            state.enemies.forEach((enemy) => {
                ctx.fillStyle = state.palette.enemy;
                ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
                ctx.fillStyle = "#ffd6eb";
                ctx.fillRect(enemy.x + enemy.w * 0.2, enemy.y + enemy.h * 0.25, enemy.w * 0.18, enemy.h * 0.18);
                ctx.fillRect(enemy.x + enemy.w * 0.62, enemy.y + enemy.h * 0.25, enemy.w * 0.18, enemy.h * 0.18);
            });

            state.bossBullets.forEach((bullet) => {
                ctx.fillStyle = state.palette.bossBullet;
                ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
            });

            if (state.boss) {
                ctx.fillStyle = state.palette.boss;
                ctx.fillRect(state.boss.x, state.boss.y, state.boss.w, state.boss.h);
                ctx.fillStyle = "#ffd6eb";
                ctx.fillRect(state.boss.x + 40, state.boss.y + 22, 24, 16);
                ctx.fillRect(state.boss.x + 116, state.boss.y + 22, 24, 16);
                ctx.fillStyle = "rgba(0,0,0,0.3)";
                ctx.fillRect(state.boss.x + 16, state.boss.y - 12, state.boss.w - 32, 7);
                ctx.fillStyle = "#67efad";
                const hpWidth = ((state.boss.w - 32) * state.boss.hp) / state.boss.maxHp;
                ctx.fillRect(state.boss.x + 16, state.boss.y - 12, Math.max(0, hpWidth), 7);
            }

            drawPlayer(players[0], state.palette.redTeam);
            if (playerIsEnabled(1)) {
                drawPlayer(players[1], state.palette.blueTeam);
            }

            if (!state.running) {
                drawStartGameOverOverlay();
            } else if (state.paused) {
                drawPausedOverlay();
            }
        }

        function normalizeKey(event) {
            return event.key.length === 1 ? event.key.toLowerCase() : event.key;
        }

        function loop() {
            update();
            draw();
            requestAnimationFrame(loop);
        }

        window.addEventListener("keydown", (event) => {
            const key = normalizeKey(event);
            state.keys.add(key);

            if (key === "escape") {
                setMenuOpen(false);
                return;
            }

            if (key === "Enter" && !state.running) {
                if (rtc.role === "guest" && rtc.connected) {
                    sendRtcMessage({ type: "input", command: "start" });
                } else {
                    resetGame();
                }
                return;
            }

            if (key === "p") {
                if (rtc.role === "guest" && rtc.connected) {
                    sendRtcMessage({ type: "input", command: "pause" });
                } else {
                    togglePause();
                }
                return;
            }

            if (!state.running) return;

            if (key === getControlsForPlayer(0).shoot) players[0].firing = true;
            if (playerIsEnabled(1) && key === getControlsForPlayer(1).shoot) players[1].firing = true;
        });

        window.addEventListener("keyup", (event) => {
            const key = normalizeKey(event);
            state.keys.delete(key);

            if (key === getControlsForPlayer(0).shoot) players[0].firing = false;
            if (playerIsEnabled(1) && key === getControlsForPlayer(1).shoot) players[1].firing = false;
        });

        singleBtn.addEventListener("click", () => setGameplayMode("single"));
        multiBtn.addEventListener("click", () => setGameplayMode("multi"));

        modeButtons.easy.addEventListener("click", () => setDifficulty("easy"));
        modeButtons.medium.addEventListener("click", () => setDifficulty("medium"));
        modeButtons.hard.addEventListener("click", () => setDifficulty("hard"));

        skinButtons.avengers.addEventListener("click", () => setSkin("avengers"));
        skinButtons.dc.addEventListener("click", () => setSkin("dc"));
        skinButtons.random.addEventListener("click", () => setSkin("random"));

        hostBtn.addEventListener("click", () => {
            createPeerConnection("host");
            localSignal.value = "";
            remoteSignal.value = "";
            updateNetStatus("HOST READY");
            refreshSignalQrs();
        });

        joinBtn.addEventListener("click", () => {
            createPeerConnection("guest");
            localSignal.value = "";
            updateNetStatus("JOIN READY");
            refreshSignalQrs();
        });

        makeOfferBtn.addEventListener("click", async () => {
            if (rtc.role !== "host" || !rtc.pc) return;
            const offer = await rtc.pc.createOffer();
            await rtc.pc.setLocalDescription(offer);
            await waitForIceComplete(rtc.pc);
            localSignal.value = JSON.stringify(rtc.pc.localDescription);
            updateNetStatus("SEND OFFER");
            refreshSignalQrs();
        });

        makeAnswerBtn.addEventListener("click", async () => {
            if (rtc.role !== "guest" || !rtc.pc) return;
            const offer = safeParseSignal(remoteSignal.value);
            if (!offer) {
                updateNetStatus("INVALID OFFER");
                return;
            }
            await rtc.pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await rtc.pc.createAnswer();
            await rtc.pc.setLocalDescription(answer);
            await waitForIceComplete(rtc.pc);
            localSignal.value = JSON.stringify(rtc.pc.localDescription);
            updateNetStatus("SEND ANSWER");
            refreshSignalQrs();
        });

        applyAnswerBtn.addEventListener("click", async () => {
            if (!rtc.pc) return;
            const parsed = safeParseSignal(remoteSignal.value);
            if (!parsed) {
                updateNetStatus("INVALID SIGNAL");
                return;
            }
            await rtc.pc.setRemoteDescription(new RTCSessionDescription(parsed));
            updateNetStatus("CONNECTING...");
            refreshSignalQrs();
        });

        resetNetBtn.addEventListener("click", () => {
            closeRtc();
        });

        menuBtn.addEventListener("click", () => {
            const open = !document.body.classList.contains("menu-open");
            setMenuOpen(open);
        });
        backdrop.addEventListener("click", () => setMenuOpen(false));

        copyLocalBtn.addEventListener("click", async () => {
            const text = localSignal.value.trim();
            if (!text) {
                updateNetStatus("NO LOCAL CODE");
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                updateNetStatus("LOCAL CODE COPIED");
            } catch (error) {
                updateNetStatus("COPY FAILED");
            }
        });

        pasteRemoteBtn.addEventListener("click", async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text) {
                    updateNetStatus("CLIPBOARD EMPTY");
                    return;
                }
                remoteSignal.value = text;
                refreshSignalQrs();
                updateNetStatus("REMOTE CODE PASTED");
            } catch (error) {
                updateNetStatus("PASTE FAILED");
            }
        });

        localSignal.addEventListener("input", refreshSignalQrs);
        remoteSignal.addEventListener("input", refreshSignalQrs);

        pauseBtn.addEventListener("click", () => {
            if (rtc.role === "guest" && rtc.connected) {
                sendRtcMessage({ type: "input", command: "pause" });
            } else {
                togglePause();
            }
        });
        startBtn.addEventListener("click", () => {
            if (rtc.role === "guest" && rtc.connected) {
                sendRtcMessage({ type: "input", command: "start" });
            } else {
                resetGame();
            }
            setMenuOpen(false);
        });

        setupTouchControls();
        initStars();
        setSkin("avengers");
        setDifficulty("easy");
        setGameplayMode(null);
        updateNetStatus("OFF");
        refreshSignalQrs();
        refreshHud();
        loop();
    
