import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createBlockMenuButton } from './block-menu-button';
import './flashcard.css';
import { generateBlockId } from './id-generator';

export interface FlashcardData {
    front: string;
    back: string;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        insertFlashcardBlock: (options?: { title?: string; cards?: FlashcardData[] }) => ReturnType;
    }
}

const DEFAULT_CARDS: FlashcardData[] = [{ front: 'Front', back: 'Back' }];
const DEFAULT_TITLE = 'Flashcards';

const EDIT_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const ADD_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const TRASH_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
const CHEVRON_LEFT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
const CHEVRON_RIGHT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
const ARROW_UP_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
const ARROW_DOWN_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const DONE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function normalizeCard(value: unknown): FlashcardData | null {
    if (Array.isArray(value)) {
        return {
            front: typeof value[0] === 'string' ? value[0] : String(value[0] ?? ''),
            back: typeof value[1] === 'string' ? value[1] : String(value[1] ?? ''),
        };
    }

    if (value && typeof value === 'object') {
        const card = value as Record<string, unknown>;
        return {
            front: typeof card.front === 'string' ? card.front : String(card.front ?? ''),
            back: typeof card.back === 'string' ? card.back : String(card.back ?? ''),
        };
    }

    return null;
}

function parseCards(value: unknown): FlashcardData[] {
    if (Array.isArray(value)) {
        return value.map(normalizeCard).filter((card): card is FlashcardData => card !== null);
    }
    if (typeof value === 'string') {
        try { return parseCards(JSON.parse(value)); } catch { return DEFAULT_CARDS; }
    }
    return DEFAULT_CARDS;
}

function serializeCards(cards: FlashcardData[]): string {
    return JSON.stringify(cards.map(({ front, back }) => [front, back]));
}

export const FlashcardBlock = Node.create({
    name: 'flashcardBlock',
    group: 'block',
    atom: true,

    addOptions() {
        return {
            onOpenBlockMenu: undefined as ((e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void) | undefined,
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('id') || element.getAttribute('data-id'),
                renderHTML: attributes => {
                    if (!attributes.id) return {};
                    return { id: attributes.id };
                },
            },
            title: {
                default: DEFAULT_TITLE,
                parseHTML: element => {
                    if (element.hasAttribute('data-t')) return element.getAttribute('data-t') ?? '';
                    if (element.hasAttribute('data-title')) return element.getAttribute('data-title') ?? '';
                    return DEFAULT_TITLE;
                },
                renderHTML: attributes => {
                    if (attributes.title === DEFAULT_TITLE) return {};
                    return { 'data-t': attributes.title ?? '' };
                },
            },
            cards: {
                default: DEFAULT_CARDS,
                parseHTML: element => {
                    const raw = element.getAttribute('data-c') || element.getAttribute('data-cards');
                    if (raw) return parseCards(raw);

                    // Fallback: Parse HTML children to reconstruct cards
                    const foundCards: FlashcardData[] = [];

                    const parseContainer = (container: Element) => {
                        const frontEl = container.querySelector('.flashcard-card-front');
                        const backEl = container.querySelector('.flashcard-card-back');

                        const front = frontEl?.querySelector('.flashcard-card-text')?.textContent 
                            || frontEl?.textContent 
                            || '';
                        const back = backEl?.querySelector('.flashcard-card-text')?.textContent 
                            || backEl?.textContent 
                            || '';

                        if (front.trim() || back.trim()) {
                            // Strip labels if present (e.g. "QUESTION", "ANSWER")
                            const cleanFront = front.replace(/^QUESTION\s*/i, '').trim();
                            const cleanBack = back.replace(/^ANSWER\s*/i, '').trim();
                            foundCards.push({ front: cleanFront, back: cleanBack });
                        }
                    };

                    // Check if the element itself is a card container
                    if (element.classList.contains('flashcard-card-container')) {
                        parseContainer(element);
                    }

                    // Check for nested card containers
                    const containers = element.querySelectorAll('.flashcard-card-container');
                    containers.forEach(parseContainer);

                    return foundCards.length > 0 ? foundCards : DEFAULT_CARDS;
                },
                renderHTML: attributes => ({
                    'data-c': serializeCards(parseCards(attributes.cards)),
                }),
            },
        };
    },

    addCommands() {
        return {
            insertFlashcardBlock: (options: { title?: string; cards?: FlashcardData[] } = {}) => ({ chain }: { chain: any }) => {
                return chain()
                    .insertContent({
                        type: this.name,
                        attrs: {
                            title: options.title ?? DEFAULT_TITLE,
                            cards: options.cards || DEFAULT_CARDS,
                        },
                    })
                    .run();
            },
        } as any;
    },

    parseHTML() {
        return [
            { tag: 'div[data-fc]', priority: 100 },
            { tag: 'div[data-type="flashcardBlock"]', priority: 100 },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, { 'data-fc': '', 'data-type': 'flashcardBlock' }),
        ];
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('flashcardIdPlugin'),
                appendTransaction: (transactions, oldState, newState) => {
                    const docChanges = transactions.some(t => t.docChanged) && !oldState.doc.eq(newState.doc);
                    if (!docChanges) return;

                    const tr = newState.tr;
                    let modified = false;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'flashcardBlock' && !node.attrs.id) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateBlockId() });
                            modified = true;
                        }
                    });

                    if (modified) return tr;
                },
            }),
        ];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            // --- State ---
            let cards = parseCards(node.attrs.cards);
            let currentTitle = node.attrs.title ?? DEFAULT_TITLE;
            let currentIndex = 0;
            let isEditing = false;
            let isFlipped = false;

            // --- Helpers ---
            const updateNode = () => {
                if (typeof getPos !== 'function') return;
                const pos = getPos();
                if (typeof pos !== 'number') return;
                editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    title: currentTitle,
                    cards: cards.map(({ front, back }) => ({ front, back })),
                }));
            };

            // ========== DOM STRUCTURE ==========

            const dom = document.createElement('div');
            dom.className = 'flashcard-block';
            dom.dataset.id = node.attrs.id;

            // --- Header ---
            const header = document.createElement('div');
            header.className = 'flashcard-header';

            const titleInput = document.createElement('input');
            titleInput.className = 'flashcard-title-input';
            titleInput.type = 'text';
            titleInput.value = currentTitle;
            titleInput.placeholder = 'Flashcard title...';
            titleInput.onmousedown = e => e.stopPropagation();
            titleInput.onclick = e => e.stopPropagation();
            titleInput.onkeydown = e => e.stopPropagation();
            titleInput.onpaste = e => e.stopPropagation();
            titleInput.oninput = () => {
                currentTitle = titleInput.value;
                updateNode();
            };

            const headerRight = document.createElement('div');
            headerRight.className = 'flashcard-header-right';

            const counter = document.createElement('span');
            counter.className = 'flashcard-counter';

            const editBtn = document.createElement('button');
            editBtn.className = 'flashcard-action-btn flashcard-edit-btn';
            editBtn.innerHTML = EDIT_SVG;
            editBtn.title = 'Edit cards';
            editBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isEditing = !isEditing;
                editBtn.classList.toggle('active', isEditing);
                renderCard();
            };

            const menuBtn = createBlockMenuButton({
                className: 'flashcard-menu-btn',
                iconSize: 'small',
                onResolve: () => {
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;
                    return {
                        pos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'flashcard',
                            id: node.attrs.id,
                            pos,
                        },
                    };
                },
                onClick: this.options.onOpenBlockMenu || undefined,
            });

            headerRight.appendChild(editBtn);
            headerRight.appendChild(menuBtn);
            header.appendChild(titleInput);
            header.appendChild(headerRight);

            // --- Card Area ---
            const cardArea = document.createElement('div');
            cardArea.className = 'flashcard-card-area';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'flashcard-nav-overlay-btn flashcard-prev-btn';
            prevBtn.innerHTML = CHEVRON_LEFT_SVG;
            prevBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cards.length <= 1) return;
                currentIndex = (currentIndex - 1 + cards.length) % cards.length;
                isFlipped = false;
                renderCard('left');
            };

            const nextBtn = document.createElement('button');
            nextBtn.className = 'flashcard-nav-overlay-btn flashcard-next-btn';
            nextBtn.innerHTML = CHEVRON_RIGHT_SVG;
            nextBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cards.length <= 1) return;
                currentIndex = (currentIndex + 1) % cards.length;
                isFlipped = false;
                renderCard('right');
            };

            const cardContainer = document.createElement('div');
            cardContainer.className = 'flashcard-card-container';

            const cardInner = document.createElement('div');
            cardInner.className = 'flashcard-card-inner';

            const cardFront = document.createElement('div');
            cardFront.className = 'flashcard-card-face flashcard-card-front';
            const frontLabel = document.createElement('span');
            frontLabel.className = 'flashcard-side-label';
            frontLabel.textContent = 'QUESTION';
            const frontText = document.createElement('div');
            frontText.className = 'flashcard-card-text';
            cardFront.appendChild(frontLabel);
            cardFront.appendChild(frontText);

            const cardBack = document.createElement('div');
            cardBack.className = 'flashcard-card-face flashcard-card-back';
            const backLabel = document.createElement('span');
            backLabel.className = 'flashcard-side-label';
            backLabel.textContent = 'ANSWER';
            const backText = document.createElement('div');
            backText.className = 'flashcard-card-text';
            cardBack.appendChild(backLabel);
            cardBack.appendChild(backText);

            cardInner.appendChild(cardFront);
            cardInner.appendChild(cardBack);
            cardContainer.appendChild(cardInner);

            // --- Footer Nav ---
            const footerNav = document.createElement('div');
            footerNav.className = 'flashcard-footer-nav';

            const editPrevBtn = document.createElement('button');
            editPrevBtn.className = 'flashcard-nav-btn flashcard-edit-nav-btn';
            editPrevBtn.innerHTML = CHEVRON_LEFT_SVG;
            editPrevBtn.title = 'Previous card';

            const editNextBtn = document.createElement('button');
            editNextBtn.className = 'flashcard-nav-btn flashcard-edit-nav-btn';
            editNextBtn.innerHTML = CHEVRON_RIGHT_SVG;
            editNextBtn.title = 'Next card';

            footerNav.appendChild(editPrevBtn);
            footerNav.appendChild(counter);
            footerNav.appendChild(editNextBtn);

            const MAX_CARD_TEXT = 500;

            cardContainer.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isEditing) return;
                isFlipped = !isFlipped;
                cardInner.classList.toggle('is-flipped', isFlipped);
            };

            // --- Edit Pane ---
            const editPane = document.createElement('div');
            editPane.className = 'flashcard-edit-pane';

            const editFooter = document.createElement('div');
            editFooter.className = 'flashcard-edit-footer';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'flashcard-edit-btn-small flashcard-delete-btn';
            deleteBtn.innerHTML = TRASH_SVG + '<span>Delete Card</span>';
            deleteBtn.title = 'Delete this card';

            const addBtn = document.createElement('button');
            addBtn.className = 'flashcard-edit-btn-small flashcard-add-btn';
            addBtn.innerHTML = ADD_SVG + '<span>Add</span>';
            addBtn.title = 'Add a new card';

            const doneBtn = document.createElement('button');
            doneBtn.className = 'flashcard-edit-btn-small flashcard-done-btn';
            doneBtn.innerHTML = DONE_SVG + '<span>Done</span>';
            doneBtn.title = 'Finish editing';
            doneBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isEditing = false;
                editBtn.classList.remove('active');
                renderCard();
            };

            const orderControls = document.createElement('div');
            orderControls.className = 'flashcard-order-controls';

            const moveUpBtn = document.createElement('button');
            moveUpBtn.className = 'flashcard-order-btn';
            moveUpBtn.innerHTML = ARROW_UP_SVG;
            moveUpBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentIndex > 0) {
                    const temp = cards[currentIndex];
                    cards[currentIndex] = cards[currentIndex - 1];
                    cards[currentIndex - 1] = temp;
                    currentIndex--;
                    updateNode();
                    renderCard();
                }
            };

            const moveDownBtn = document.createElement('button');
            moveDownBtn.className = 'flashcard-order-btn';
            moveDownBtn.innerHTML = ARROW_DOWN_SVG;
            moveDownBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentIndex < cards.length - 1) {
                    const temp = cards[currentIndex];
                    cards[currentIndex] = cards[currentIndex + 1];
                    cards[currentIndex + 1] = temp;
                    currentIndex++;
                    updateNode();
                    renderCard();
                }
            };

            orderControls.appendChild(moveUpBtn);
            orderControls.appendChild(moveDownBtn);

            // --- Assembly ---
            cardArea.appendChild(prevBtn);
            cardArea.appendChild(cardContainer);
            cardArea.appendChild(nextBtn);
            cardArea.appendChild(editPane);
            cardArea.appendChild(footerNav);
            dom.appendChild(header);
            dom.appendChild(cardArea);

            // ========== RENDER LOGIC ==========

            const renderCard = (slideDirection?: 'left' | 'right') => {
                if (cards.length === 0) currentIndex = 0;
                else if (currentIndex >= cards.length) currentIndex = cards.length - 1;

                const card = cards[currentIndex];
                counter.textContent = cards.length > 0 ? `${currentIndex + 1} / ${cards.length}` : '0 / 0';
                prevBtn.style.display = (cards.length > 1 && !isEditing) ? '' : 'none';
                nextBtn.style.display = (cards.length > 1 && !isEditing) ? '' : 'none';

                const hasMultipleCards = cards.length > 1;
                editPrevBtn.style.display = (isEditing && hasMultipleCards) ? '' : 'none';
                editNextBtn.style.display = (isEditing && hasMultipleCards) ? '' : 'none';

                editPrevBtn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
                    isFlipped = false;
                    renderCard();
                };
                editNextBtn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    currentIndex = (currentIndex + 1) % cards.length;
                    isFlipped = false;
                    renderCard();
                };

                if (isEditing && card) {
                    cardContainer.style.display = 'none';
                    editPane.style.display = 'flex';
                    editPane.innerHTML = '';

                    const editHeader = document.createElement('div');
                    editHeader.className = 'flashcard-edit-header';
                    const indexText = document.createElement('span');
                    indexText.textContent = `Order: ${currentIndex + 1} of ${cards.length}`;
                    editHeader.appendChild(indexText);
                    editHeader.appendChild(orderControls);
                    editPane.appendChild(editHeader);

                    const frontLabel = document.createElement('label');
                    frontLabel.className = 'flashcard-edit-label';
                    frontLabel.textContent = 'Front (Question)';
                    const frontInput = document.createElement('textarea');
                    frontInput.className = 'flashcard-edit-input';
                    frontInput.value = card.front;
                    frontInput.placeholder = 'Type question...';
                    frontInput.oninput = () => { card.front = frontInput.value; updateNode(); };

                    const backLabel = document.createElement('label');
                    backLabel.className = 'flashcard-edit-label';
                    backLabel.textContent = 'Back (Answer)';
                    const backInput = document.createElement('textarea');
                    backInput.className = 'flashcard-edit-input';
                    backInput.value = card.back;
                    backInput.placeholder = 'Type answer...';
                    backInput.oninput = () => { card.back = backInput.value; updateNode(); };

                    editPane.appendChild(frontLabel);
                    editPane.appendChild(frontInput);
                    editPane.appendChild(backLabel);
                    editPane.appendChild(backInput);

                    // Update footer layout
                    editFooter.innerHTML = '';
                    const footerRight = document.createElement('div');
                    footerRight.className = 'flashcard-edit-footer-right';

                    if (cards.length > 1) {
                        deleteBtn.onclick = (e) => {
                            e.preventDefault(); e.stopPropagation();
                            cards.splice(currentIndex, 1);
                            if (currentIndex >= cards.length) currentIndex = Math.max(0, cards.length - 1);
                            updateNode(); renderCard();
                        };
                        editFooter.appendChild(deleteBtn);
                    }

                    addBtn.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        cards.push({ front: '', back: '' });
                        currentIndex = cards.length - 1;
                        isFlipped = false;
                        updateNode(); renderCard('right');
                    };

                    footerRight.appendChild(addBtn);
                    footerRight.appendChild(doneBtn);
                    editFooter.appendChild(footerRight);
                    editPane.appendChild(editFooter);

                    // Move controls visibility
                    moveUpBtn.disabled = currentIndex === 0;
                    moveDownBtn.disabled = currentIndex === cards.length - 1;

                    // Stop events from reaching ProseMirror
                    [frontInput, backInput].forEach(el => {
                        el.onmousedown = e => e.stopPropagation();
                        el.onclick = e => e.stopPropagation();
                        el.onkeydown = e => e.stopPropagation();
                        el.onpaste = e => e.stopPropagation();
                    });
                } else {
                    cardContainer.style.display = 'flex';
                    editPane.style.display = 'none';

                    // Card faces
                    if (card) {
                        const ft = card.front.length > MAX_CARD_TEXT ? card.front.slice(0, MAX_CARD_TEXT) + '…' : card.front;
                        const bt = card.back.length > MAX_CARD_TEXT ? card.back.slice(0, MAX_CARD_TEXT) + '…' : card.back;
                        frontText.textContent = ft || '(empty)';
                        backText.textContent = bt || '(empty)';
                        cardFront.classList.toggle('empty', !card.front);
                        cardBack.classList.toggle('empty', !card.back);
                    } else {
                        frontText.textContent = 'No cards yet';
                        backText.textContent = '';
                        cardFront.classList.add('empty');
                    }

                    // Flip state - reset to front when sliding
                    if (slideDirection) {
                        cardInner.classList.add('no-transition');
                    }
                    cardInner.classList.toggle('is-flipped', isFlipped);
                    if (slideDirection) {
                        // Force reflow
                        void cardInner.offsetWidth;
                        cardInner.classList.remove('no-transition');
                    }

                    // Animation
                    if (slideDirection) {
                        cardContainer.classList.remove('slide-in-left', 'slide-in-right');
                        // Force reflow
                        void cardContainer.offsetWidth;
                        cardContainer.classList.add(slideDirection === 'left' ? 'slide-in-left' : 'slide-in-right');
                    }
                }
            };

            // Initial render
            renderCard();

            return {
                dom,
                update: (newNode) => {
                    if (newNode.type.name !== 'flashcardBlock') return false;
                    dom.dataset.id = newNode.attrs.id;
                    const activeElement = document.activeElement as HTMLElement | null;
                    const isEditingCardInput = isEditing && !!activeElement && editPane.contains(activeElement);

                    node = newNode;

                    if (isEditingCardInput) {
                        return true;
                    }

                    const newCards = parseCards(newNode.attrs.cards);
                    const newTitle = newNode.attrs.title ?? DEFAULT_TITLE;

                    cards = newCards;
                    currentTitle = newTitle;
                    if (titleInput.value !== newTitle) {
                        titleInput.value = newTitle;
                    }

                    if (currentIndex >= cards.length) {
                        currentIndex = Math.max(0, cards.length - 1);
                        isFlipped = false;
                    }

                    renderCard();
                    return true;
                },
                stopEvent: (event) => {
                    const target = event.target as HTMLElement;
                    if (!target) return false;
                    if (dom.contains(target)) return true;
                    return false;
                },
                ignoreMutation: () => true,
                destroy: () => { },
            };
        };
    },
});
