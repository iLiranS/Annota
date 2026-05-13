import Youtube from '@tiptap/extension-youtube';
import './custom-youtube.css';

function extractVideoId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : null;
}

export const CustomYoutube = Youtube.extend({
    // Only the URL is meaningful — drop width/height/start from base extension.
    addAttributes() {
        return {
            src: { default: null },
        };
    },

    // ─── Storage format ───────────────────────────────────────────────────────
    // Only the video URL is stored. The NodeView below handles all rendering.
    // A typical YouTube embed stores as: <div data-youtube="VIDEO_ID"></div>
    // (~40 chars vs ~1500 chars of old inline-style HTML).
    renderHTML({ HTMLAttributes }) {
        const src = HTMLAttributes.src as string | null;
        const videoId = src ? extractVideoId(src) : null;
        return [
            'div',
            {
                'data-type': 'youtube',
                'data-youtube': videoId ?? '',
                'data-yt-src': src ?? '',   // keep full URL for round-trip fidelity
            },
        ];
    },

    parseHTML() {
        return [
            // Primary: new minimal format
            {
                tag: 'div[data-type="youtube"]',
                getAttrs: (dom) => {
                    // Prefer full URL, fall back to constructing from video ID
                    const src = dom.getAttribute('data-yt-src');
                    const id = dom.getAttribute('data-youtube');
                    if (src) return { src };
                    if (id) return { src: `https://www.youtube.com/watch?v=${id}` };
                    return false;
                },
            },
            // Legacy: old wrapper format (existing saved notes)
            {
                tag: 'div[data-youtube-wrapper="true"]',
                getAttrs: (dom) => {
                    const src = dom.getAttribute('data-yt-src');
                    return src ? { src } : false;
                },
            },
            // Legacy: anchor tag format
            {
                tag: 'a[data-yt-src]',
                getAttrs: (dom) => {
                    const src = dom.getAttribute('data-yt-src');
                    return src ? { src } : false;
                },
            },
            // Legacy: iframe parsers
            { tag: 'iframe[src*="youtube.com"]' },
            { tag: 'iframe[src*="youtu.be"]' },
            { tag: 'iframe[src*="youtube-nocookie.com"]' },
        ];
    },

    // ─── Visual rendering (NodeView) ─────────────────────────────────────────
    // Builds the thumbnail UI in the browser — nothing here affects storage.
    addNodeView() {
        return ({ node }) => {
            const src = node.attrs.src as string | null;
            const videoId = src ? extractVideoId(src) : null;

            const wrapper = document.createElement('div');
            wrapper.className = 'yt-wrapper';
            wrapper.contentEditable = 'false';

            if (!videoId) {
                wrapper.innerHTML = '<div class="youtube-error">Invalid YouTube URL</div>';
                return { dom: wrapper };
            }

            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

            const renderThumbnail = () => {
                wrapper.innerHTML = `
                    <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="yt-embed-link">
                        <img class="yt-thumbnail" src="${thumbnailUrl}" alt="YouTube Thumbnail">
                        <div class="yt-play-button">
                            <div class="yt-play-icon"></div>
                        </div>
                    </a>
                `;

                const link = wrapper.querySelector('.yt-embed-link') as HTMLAnchorElement;
                link.onclick = (e) => {
                    const isMobileNative = typeof window !== 'undefined' && !!(window as any).ReactNativeWebView;
                    if (isMobileNative) {
                        e.preventDefault();
                        // On mobile native, swap to inline iframe
                        renderIframe();
                    }
                    // On desktop, we let the default <a> behavior handle it, 
                    // which we will intercept in App.tsx to ensure it opens externally.
                };
            };

            const renderIframe = () => {
                // Determine origin if available to satisfy YouTube's iframe API 
                // and potentially bypass strict Tauri restrictions.
                let origin = '';
                try {
                    origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
                } catch (e) { }

                const originParam = origin && origin !== 'null' ? `&origin=${encodeURIComponent(origin)}` : '';
                const iframeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1${originParam}`;

                wrapper.innerHTML = `
                    <div class="yt-embed-link">
                        <iframe 
                            src="${iframeUrl}" 
                            title="YouTube video player" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
                        ></iframe>
                    </div>
                `;
            };

            renderThumbnail();

            return {
                dom: wrapper,
                ignoreMutation: () => true,
                update: (updatedNode) => updatedNode.type.name === this.name,
            };
        };
    },
});