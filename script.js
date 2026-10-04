(() => {
    "use strict";

    const THEME_KEY = "selected-theme";
    const INTERACTIVE = "a, button, input, textarea, label, .id-card";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    function moveIndicator(indicator, target, animate = true) {
        if (!animate) indicator.style.transition = "none";
        indicator.style.width = `${target.offsetWidth}px`;
        indicator.style.transform = `translateX(${target.offsetLeft}px)`;
        indicator.style.opacity = "1";
        if (!animate) {
            indicator.getBoundingClientRect();
            indicator.style.transition = "";
        }
    }
    function initImageFallback() {
        $$("img[src]").forEach((image) => {
            const markMissing = () => image.classList.add("is-missing");
            image.addEventListener("error", markMissing, { once: true });
            if (image.complete && image.naturalWidth === 0) markMissing();
        });
    }

    function initYear() {
        $("#year").textContent = new Date().getFullYear();
    }

    function initTheme() {
        const root = document.documentElement;
        const toggle = $("#theme-toggle");

        const apply = (theme) => {
            root.dataset.theme = theme;
            toggle.setAttribute("aria-label", theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap");
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (error) {}
        };

        const reveal = (transition) => {
            const { left, top, width, height } = toggle.getBoundingClientRect();
            const x = left + width / 2;
            const y = top + height / 2;
            const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

            transition.ready
                .then(() => {
                    root.animate(
                        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                        { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
                    );
                })
                .catch(() => {});
        };

        apply(root.dataset.theme);

        toggle.addEventListener("click", () => {
            const next = root.dataset.theme === "dark" ? "light" : "dark";
            if (reducedMotion || !document.startViewTransition) {
                apply(next);
                return;
            }
            reveal(document.startViewTransition(() => apply(next)));
        });
    }

    function initIntro() {
        const PLAYER = "X";
        const OPPONENT = "O";
        const LINES = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        const RESULTS = {
            win: "Kamu menang. Silakan masuk.",
            lose: "Kamu kalah kali ini. Coba lagi, atau langsung masuk.",
            draw: "Seri. Tetap hebat, silakan masuk."
        };

        const intro = $("#intro");
        const site = $("#site");
        const board = $("#board");
        const status = $("#intro-status");
        const restart = $("#intro-restart");
        const enter = $("#intro-enter");

        const cells = Array.from({ length: 9 }, (_, index) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "board__cell";
            cell.dataset.index = index;
            board.append(cell);
            return cell;
        });

        let marks = [];
        let locked = false;

        const findLine = (mark) => LINES.find((line) => line.every((index) => marks[index] === mark));
        const emptyIndexes = () => marks.flatMap((mark, index) => (mark ? [] : [index]));

        const completingMove = (mark) =>
            emptyIndexes().find((index) => {
                marks[index] = mark;
                const completes = Boolean(findLine(mark));
                marks[index] = null;
                return completes;
            });

        const chooseOpponentMove = () => {
            const winning = completingMove(OPPONENT);
            if (winning !== undefined && Math.random() < 0.6) return winning;
            const blocking = completingMove(PLAYER);
            if (blocking !== undefined && Math.random() < 0.7) return blocking;
            const free = emptyIndexes();
            return free[Math.floor(Math.random() * free.length)];
        };

        const setEnterLabel = (finished) => {
            enter.textContent = finished ? "Masuk ke portofolio" : "Lewati game";
            enter.classList.toggle("button--primary", finished);
        };

        const place = (index, mark) => {
            marks[index] = mark;
            cells[index].textContent = mark;
            cells[index].dataset.mark = mark;
            cells[index].setAttribute("aria-label", `Kotak ${index + 1}, ${mark}`);
        };

        const finish = (result, line = []) => {
            locked = true;
            line.forEach((index) => cells[index].classList.add("is-winning"));
            status.textContent = RESULTS[result];
            restart.hidden = false;
            setEnterLabel(true);
        };

        const evaluate = (mark) => {
            const line = findLine(mark);
            if (line) {
                finish(mark === PLAYER ? "win" : "lose", line);
                return true;
            }
            if (!emptyIndexes().length) {
                finish("draw");
                return true;
            }
            return false;
        };

        const reset = () => {
            marks = Array(9).fill(null);
            locked = false;
            cells.forEach((cell, index) => {
                cell.textContent = "";
                cell.classList.remove("is-winning");
                delete cell.dataset.mark;
                cell.setAttribute("aria-label", `Kotak ${index + 1}, kosong`);
            });
            status.textContent = "Giliranmu. Kamu bermain sebagai X.";
            restart.hidden = true;
            setEnterLabel(false);
        };

        const play = (index) => {
            if (locked || marks[index]) return;
            place(index, PLAYER);
            if (evaluate(PLAYER)) return;

            locked = true;
            status.textContent = "Giliran lawan…";
            window.setTimeout(() => {
                place(chooseOpponentMove(), OPPONENT);
                if (evaluate(OPPONENT)) return;
                locked = false;
                status.textContent = "Giliranmu.";
            }, 450);
        };

        const close = () => {
            intro.classList.add("is-closing");
            site.inert = false;
            document.documentElement.classList.add("is-ready");
            document.dispatchEvent(new CustomEvent("portfolio:ready"));
            $(".hero__title").focus({ preventScroll: true });
            window.setTimeout(() => {
                intro.hidden = true;
            }, 700);
        };

        site.inert = true;
        reset();

        board.addEventListener("click", (event) => {
            const cell = event.target.closest(".board__cell");
            if (cell) play(Number(cell.dataset.index));
        });
        restart.addEventListener("click", reset);
        enter.addEventListener("click", close);
        cells[4].focus({ preventScroll: true });
    }

    function initReveal() {
        $$("[data-stagger]").forEach((group) => {
            Array.from(group.children).forEach((child, index) => {
                child.setAttribute("data-reveal", group.dataset.stagger);
                child.style.setProperty("--delay", `${index * 0.09}s`);
            });
        });

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(({ target, isIntersecting, boundingClientRect }) => {
                    target.classList.toggle("is-visible", isIntersecting);
                    target.classList.toggle("is-above", !isIntersecting && boundingClientRect.top < window.innerHeight / 2);
                });
            },
            { threshold: 0.12, rootMargin: "-4% 0px -4% 0px" }
        );

        $$("[data-reveal]").forEach((element) => observer.observe(element));
    }

    function initScrollLists() {
        $$("[data-scroll-limit]").forEach((container) => {
            const list = $(".timeline", container);
            const items = Array.from(list.children);
            const limit = Number(container.dataset.scrollLimit);

            const fit = () => {
                if (items.length <= limit) return;
                const last = items[limit - 1];
                const paddingBottom = parseFloat(getComputedStyle(container).paddingBottom);
                container.style.maxHeight = `${list.offsetTop + last.offsetTop + last.offsetHeight + paddingBottom + 16}px`;
            };

            const syncFades = () => {
                const { scrollTop, scrollHeight, clientHeight } = container;
                container.style.setProperty("--fade-top", scrollTop > 4 ? "22px" : "0px");
                container.style.setProperty("--fade-bottom", scrollTop + clientHeight < scrollHeight - 4 ? "22px" : "0px");
            };

            container.addEventListener("scroll", syncFades, { passive: true });
            window.addEventListener("resize", () => {
                fit();
                syncFades();
            });
            if (document.fonts) {
                document.fonts.ready.then(() => {
                    fit();
                    syncFades();
                });
            }

            fit();
            syncFades();
        });
    }

    function initNav() {
        const links = $$(".nav__link");
        const indicator = $(".nav__indicator");
        const sections = links.map((link) => $(link.getAttribute("href")));
        let current = links[0];
        let lockedUntil = 0;

        const activate = (link, animate = true) => {
            current = link;
            links.forEach((item) => {
                const active = item === link;
                item.classList.toggle("is-active", active);
                if (active) item.setAttribute("aria-current", "true");
                else item.removeAttribute("aria-current");
            });
            moveIndicator(indicator, link, animate);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                if (performance.now() < lockedUntil) return;
                entries.forEach((entry) => {
                    if (entry.isIntersecting) activate(links[sections.indexOf(entry.target)]);
                });
            },
            { rootMargin: "-45% 0px -50% 0px" }
        );

        sections.forEach((section) => observer.observe(section));

        links.forEach((link) => {
            link.addEventListener("click", () => {
                lockedUntil = performance.now() + 1000;
                activate(link);
            });
        });

        window.addEventListener(
            "scroll",
            () => {
                const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
                const last = links[links.length - 1];
                if (atBottom && current !== last && performance.now() >= lockedUntil) activate(last);
            },
            { passive: true }
        );

        window.addEventListener("resize", () => moveIndicator(indicator, current, false));
        if (document.fonts) document.fonts.ready.then(() => moveIndicator(indicator, current, false));

        activate(current, false);
    }

    function initTabs() {
        $$("[data-tabs]").forEach((root) => {
            const tabs = $$('[role="tab"]', root);
            const indicator = $(".tabs__indicator", root);
            let selected = tabs[0];

            const select = (tab, animate = true) => {
                selected = tab;
                tabs.forEach((item) => {
                    const active = item === tab;
                    item.setAttribute("aria-selected", String(active));
                    item.tabIndex = active ? 0 : -1;
                    document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
                });
                moveIndicator(indicator, tab, animate);
            };

            tabs.forEach((tab, index) => {
                tab.addEventListener("click", () => select(tab));
                tab.addEventListener("keydown", (event) => {
                    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
                    if (!(event.key in keys)) return;
                    event.preventDefault();
                    const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
                    select(next);
                    next.focus();
                });
            });

            window.addEventListener("resize", () => moveIndicator(indicator, selected, false));
            if (document.fonts) document.fonts.ready.then(() => moveIndicator(indicator, selected, false));

            select(selected, false);
        });
    }

    function initLightbox() {
        const dialog = $("#lightbox");
        const image = $("#lightbox-img");
        const caption = $("#lightbox-caption");
        const items = $$("[data-cert]");
        let index = 0;

        const show = (nextIndex) => {
            index = (nextIndex + items.length) % items.length;
            const targetItem = items[index];
            
            // Ambil langsung dari atribut data-src atau dari tag img di dalam tombol
            const src = targetItem.dataset.src || targetItem.querySelector("img").getAttribute("src");
            const text = targetItem.dataset.caption || "";

            image.classList.remove("is-missing");
            image.src = src;
            image.alt = text;
            caption.textContent = text;

            if (!reducedMotion && image.animate) {
                image.animate(
                    [{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }],
                    { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
                );
            }
        };

        items.forEach((item, itemIndex) => {
            item.addEventListener("click", () => {
                show(itemIndex);
                dialog.showModal();
            });
        });

        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
            const action = event.target.closest("[data-lightbox]")?.dataset.lightbox;
            if (action === "close") dialog.close();
            if (action === "prev") show(index - 1);
            if (action === "next") show(index + 1);
        });

        dialog.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") show(index - 1);
            if (event.key === "ArrowRight") show(index + 1);
        });
    }

    function initContact() {
        const form = $("#contact-form");
        const status = $("#form-status");

        $$("[data-copy]").forEach((button) => {
            const icon = $("use", button);
            button.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(button.dataset.copy);
                } catch (error) {
                    return;
                }
                button.classList.add("is-copied");
                button.setAttribute("aria-label", "Email tersalin");
                icon.setAttribute("href", "#i-check");
                window.setTimeout(() => {
                    button.classList.remove("is-copied");
                    button.setAttribute("aria-label", "Salin email");
                    icon.setAttribute("href", "#i-copy");
                }, 1800);
            });
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const subject = encodeURIComponent(`Pesan dari ${data.get("name").trim()}`);
            const body = encodeURIComponent(`${data.get("message").trim()}\n\nBalas ke: ${data.get("email").trim()}`);
            status.textContent = "Membuka aplikasi email dengan pesanmu…";
            window.location.href = `mailto:${form.dataset.recipient}?subject=${subject}&body=${body}`;
        });
    }

    function initPointer() {
        const backdrop = $(".backdrop");
        const cursor = $("#cursor");

        if (!finePointer || reducedMotion) {
            cursor.remove();
            return;
        }

        const ring = $(".cursor__ring", cursor);
        const dot = $(".cursor__dot", cursor);
        const pointer = { x: 0, y: 0 };
        const ringPosition = { x: 0, y: 0 };
        const glowPosition = { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
        const scale = { ring: 1, dot: 1 };
        const goal = { ring: 1, dot: 1 };
        let placed = false;
        let running = false;
        let lastTime = 0;

        const ease = (delta, tau) => 1 - Math.exp(-delta / tau);

        const draw = () => {
            const lagX = pointer.x - ringPosition.x;
            const lagY = pointer.y - ringPosition.y;
            const stretch = Math.min(Math.hypot(lagX, lagY) / 120, 0.55);
            const angle = Math.atan2(lagY, lagX);
            const stretchX = (1 + stretch) * scale.ring;
            const stretchY = (1 - stretch * 0.4) * scale.ring;

            dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) scale(${scale.dot})`;
            ring.style.transform = `translate3d(${ringPosition.x}px, ${ringPosition.y}px, 0) rotate(${angle}rad) scale(${stretchX}, ${stretchY})`;
            backdrop.style.setProperty("--mx", `${glowPosition.x}px`);
            backdrop.style.setProperty("--my", `${glowPosition.y}px`);
        };

        const tick = (time) => {
            const delta = Math.min(time - lastTime, 50);
            lastTime = time;

            const ringEase = ease(delta, 90);
            const glowEase = ease(delta, 260);
            ringPosition.x += (pointer.x - ringPosition.x) * ringEase;
            ringPosition.y += (pointer.y - ringPosition.y) * ringEase;
            glowPosition.x += (pointer.x - glowPosition.x) * glowEase;
            glowPosition.y += (pointer.y - glowPosition.y) * glowEase;
            scale.ring += (goal.ring - scale.ring) * ease(delta, 110);
            scale.dot += (goal.dot - scale.dot) * ease(delta, 90);

            draw();

            const settled =
                Math.hypot(pointer.x - ringPosition.x, pointer.y - ringPosition.y) < 0.15 &&
                Math.hypot(pointer.x - glowPosition.x, pointer.y - glowPosition.y) < 0.3 &&
                Math.abs(goal.ring - scale.ring) < 0.002 &&
                Math.abs(goal.dot - scale.dot) < 0.002;

            if (settled) running = false;
            else requestAnimationFrame(tick);
        };

        const wake = () => {
            if (running) return;
            running = true;
            lastTime = performance.now();
            requestAnimationFrame(tick);
        };

        const hoverGoal = () => (cursor.classList.contains("is-active") ? 1.9 : 1);

        window.addEventListener(
            "pointermove",
            (event) => {
                if (event.pointerType === "touch") return;
                pointer.x = event.clientX;
                pointer.y = event.clientY;
                if (!placed) {
                    ringPosition.x = pointer.x;
                    ringPosition.y = pointer.y;
                    placed = true;
                    draw();
                }
                cursor.classList.add("is-visible");
                wake();
            },
            { passive: true }
        );

        document.addEventListener("pointerover", (event) => {
            const active = Boolean(event.target.closest(INTERACTIVE));
            cursor.classList.toggle("is-active", active);
            goal.ring = hoverGoal();
            goal.dot = active ? 0 : 1;
            wake();
        });

        document.addEventListener("pointerdown", () => {
            goal.ring = hoverGoal() * 0.8;
            wake();
        });

        document.addEventListener("pointerup", () => {
            goal.ring = hoverGoal();
            wake();
        });

        document.documentElement.addEventListener("pointerleave", () => {
            cursor.classList.remove("is-visible");
            placed = false;
        });
    }

    function initMagnetic() {
        if (!finePointer || reducedMotion) return;

        $$(".button").forEach((button) => {
            button.addEventListener("pointermove", (event) => {
                const rect = button.getBoundingClientRect();
                const x = (event.clientX - rect.left - rect.width / 2) * 0.18;
                const y = (event.clientY - rect.top - rect.height / 2) * 0.3;
                button.style.translate = `${x}px ${y}px`;
            });
            button.addEventListener("pointerleave", () => {
                button.style.translate = "";
            });
        });
    }

    function initLanyard() {
        const wrapper = $("#lanyard");
        const card = $("#id-card");
        const path = $("#lanyard-path");
        const pin = $("#lanyard-pin");

        const SEGMENTS = 9;
        const SEGMENT_LENGTH = 16;
        const REST_LENGTH = SEGMENTS * SEGMENT_LENGTH;
        const GRAVITY = 0.55;
        const DAMPING = 0.988;
        const ITERATIONS = 12;
        const STEP = 1 / 60;
        const SLOT_OFFSET = 14;
        const STRAP_WIDTH = 7;
        const ELASTIC = {
            stiffness: 0.06,
            damping: 2 * 0.13 * Math.sqrt(0.06),
            min: 0.72,
            max: 2.4,
            resistance: 0.8
        };

        const anchor = { x: 0, y: 14 };
        const grab = { x: 0, y: 0 };
        const target = { x: 0, y: 0 };

        let nodes = [];
        let cardWidth = 0;
        let angle = 0;
        let angleVelocity = 0;
        let stretch = 1;
        let stretchVelocity = 0;
        let stretchGoal = 1;
        let dragging = false;
        let visible = false;
        let running = false;
        let lastTime = 0;
        let accumulator = 0;
        let calmFrames = 0;

        const measure = () => {
            anchor.x = wrapper.clientWidth / 2;
            cardWidth = card.offsetWidth;
            pin.setAttribute("cx", anchor.x);
            pin.setAttribute("cy", anchor.y);
        };

        const createNodes = (swing = 0) => {
            nodes = Array.from({ length: SEGMENTS + 1 }, (_, index) => {
                const x = anchor.x + Math.sin(swing) * index * SEGMENT_LENGTH;
                const y = anchor.y + Math.cos(swing) * index * SEGMENT_LENGTH;
                const weight = index === 0 ? 0 : index === SEGMENTS ? 0.3 : 1;
                return { x, y, previousX: x, previousY: y, weight };
            });
            angle = 0;
            angleVelocity = 0;
            stretch = 1;
            stretchVelocity = 0;
            stretchGoal = 1;
        };

        const stretched = (node) => ({
            x: anchor.x + (node.x - anchor.x) * stretch,
            y: anchor.y + (node.y - anchor.y) * stretch
        });

        const simulate = () => {
            stretchVelocity += (stretchGoal - stretch) * ELASTIC.stiffness - stretchVelocity * ELASTIC.damping;
            stretch = clamp(stretch + stretchVelocity, ELASTIC.min, ELASTIC.max);

            nodes.forEach((node) => {
                if (!node.weight) return;
                const velocityX = (node.x - node.previousX) * DAMPING;
                const velocityY = (node.y - node.previousY) * DAMPING;
                node.previousX = node.x;
                node.previousY = node.y;
                node.x += velocityX;
                node.y += velocityY + GRAVITY;
            });

            const tip = nodes[nodes.length - 1];
            if (dragging) {
                const goalX = anchor.x + (target.x - anchor.x) / stretch;
                const goalY = anchor.y + (target.y - anchor.y) / stretch;
                tip.x += (goalX - tip.x) * 0.4;
                tip.y += (goalY - tip.y) * 0.4;
            }

            for (let pass = 0; pass < ITERATIONS; pass++) {
                nodes[0].x = anchor.x;
                nodes[0].y = anchor.y;
                for (let index = 0; index < nodes.length - 1; index++) {
                    const a = nodes[index];
                    const b = nodes[index + 1];
                    const totalWeight = a.weight + b.weight;
                    if (!totalWeight) continue;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const distance = Math.hypot(dx, dy) || 0.0001;
                    const correction = (distance - SEGMENT_LENGTH) / distance;
                    a.x += dx * correction * (a.weight / totalWeight);
                    a.y += dy * correction * (a.weight / totalWeight);
                    b.x -= dx * correction * (b.weight / totalWeight);
                    b.y -= dy * correction * (b.weight / totalWeight);
                }
            }

            const before = nodes[nodes.length - 3];
            const desired = -Math.atan2(tip.x - before.x, tip.y - before.y);
            angleVelocity = (angleVelocity + (desired - angle) * 0.1) * 0.8;
            angle = clamp(angle + angleVelocity, -1.05, 1.05);
        };

        const render = () => {
            const points = nodes.map(stretched);
            const tip = points[points.length - 1];
            card.style.transform = `translate(${tip.x - cardWidth / 2}px, ${tip.y - SLOT_OFFSET}px) rotate(${angle}rad)`;

            let d = `M ${points[0].x} ${points[0].y}`;
            for (let index = 1; index < points.length - 1; index++) {
                const current = points[index];
                const next = points[index + 1];
                d += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
            }
            d += ` L ${tip.x} ${tip.y}`;
            path.setAttribute("d", d);
            path.setAttribute("stroke-width", (STRAP_WIDTH / Math.sqrt(stretch)).toFixed(2));
        };

        const energy = () =>
            nodes.reduce((sum, node) => sum + Math.abs(node.x - node.previousX) + Math.abs(node.y - node.previousY), 0) +
            Math.abs(angleVelocity) * 10 +
            Math.abs(stretchVelocity) * 30 +
            Math.abs(stretch - 1) * 3;

        const frame = (time) => {
            if (!visible) {
                running = false;
                return;
            }

            accumulator += Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;
            while (accumulator >= STEP) {
                simulate();
                accumulator -= STEP;
            }
            render();

            calmFrames = !dragging && energy() < 0.05 ? calmFrames + 1 : 0;
            if (calmFrames > 60) {
                running = false;
                return;
            }
            requestAnimationFrame(frame);
        };

        const start = () => {
            calmFrames = 0;
            if (running || !visible) return;
            running = true;
            lastTime = performance.now();
            requestAnimationFrame(frame);
        };

        const pointerPosition = (event) => {
            const rect = wrapper.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };

        const pull = () => {
            const dx = target.x - anchor.x;
            const dy = target.y - anchor.y;
            const distance = Math.hypot(dx, dy);
            const limit = REST_LENGTH * ELASTIC.max;
            if (distance > limit) {
                target.x = anchor.x + (dx / distance) * limit;
                target.y = anchor.y + (dy / distance) * limit;
            }
            const ratio = Math.min(distance, limit) / REST_LENGTH;
            stretchGoal = clamp(1 + (ratio - 1) * ELASTIC.resistance, 1, ELASTIC.max);
        };

        const release = () => {
            dragging = false;
            stretchGoal = 1;
            card.classList.remove("is-dragging");
            start();
        };

        card.addEventListener("pointerdown", (event) => {
            const tip = stretched(nodes[nodes.length - 1]);
            const pointer = pointerPosition(event);
            dragging = true;
            grab.x = pointer.x - tip.x;
            grab.y = pointer.y - tip.y;
            target.x = tip.x;
            target.y = tip.y;
            card.setPointerCapture(event.pointerId);
            card.classList.add("is-dragging");
            start();
        });

        card.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            const pointer = pointerPosition(event);
            target.x = pointer.x - grab.x;
            target.y = pointer.y - grab.y;
            pull();
        });

        card.addEventListener("pointerup", release);
        card.addEventListener("pointercancel", release);
        card.addEventListener("lostpointercapture", release);

        window.addEventListener("resize", () => {
            measure();
            nodes[0].x = anchor.x;
            start();
        });

        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) start();
        }).observe(wrapper);

        document.addEventListener("portfolio:ready", () => {
            if (reducedMotion) return;
            createNodes(0.95);
            start();
        });

        measure();
        createNodes();
        render();
    }

    function initTypedEffect() {
        const typedElement = $(".typed-text");
        if (!typedElement) return;

        const words = JSON.parse(typedElement.dataset.words || "[]");
        if (words.length === 0) return;

        let wordIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 100;

        function type() {
            const currentWord = words[wordIndex];
            
            if (isDeleting) {
                typedElement.textContent = currentWord.substring(0, charIndex - 1);
                charIndex--;
                typeSpeed = 50; // Lebih cepat saat menghapus
            } else {
                typedElement.textContent = currentWord.substring(0, charIndex + 1);
                charIndex++;
                typeSpeed = 100; // Kecepatan normal saat mengetik
            }

            if (!isDeleting && charIndex === currentWord.length) {
                isDeleting = true;
                typeSpeed = 2000; // Jeda waktu sebelum mulai menghapus (2 detik)
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                typeSpeed = 500; // Jeda waktu sebelum mengetik kata baru
            }

            setTimeout(type, typeSpeed);
        }

        setTimeout(type, 1000);
    }

    initImageFallback();
    initYear();
    initTheme();
    initIntro();
    initReveal();
    initScrollLists();
    initNav();
    initTabs();
    initLightbox();
    initContact();
    initPointer();
    initMagnetic();
    initLanyard();
    initTypedEffect();  
})();
