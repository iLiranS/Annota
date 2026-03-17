import Youtube from '@tiptap/extension-youtube';

function extractVideoId(urlOrId: string) {
    if (!urlOrId) return null;
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : null;
}

export const CustomYoutube = Youtube.extend({
    renderHTML({ HTMLAttributes }) {
        const originalSrc = HTMLAttributes.src as string;
        const videoId = extractVideoId(originalSrc);

        if (!videoId) {
            return ['div', { class: 'youtube-error' }, 'Invalid YouTube URL'];
        }

        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return [
            // 1. Wrap the entire element in a block-level div to satisfy the schema
            'div',
            {
                'data-youtube-wrapper': 'true',
                'data-yt-src': originalSrc, // Keep the URL here for the parser
                contenteditable: 'false',
                style: 'display: flex; justify-content: center; width: 100%; margin: 24px 0;',
            },
            // 2. The interactive anchor tag goes inside
            [
                'a',
                {
                    class: 'yt-embed-link',
                    href: watchUrl,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    style: 'display: block; position: relative; width: 100%; max-width: 640px; text-decoration: none; cursor: pointer; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);',
                },
                [
                    'img',
                    {
                        src: thumbnailUrl,
                        alt: 'YouTube Thumbnail',
                        style: 'display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; opacity: 0.9; transition: opacity 0.3s;',
                    },
                ],
                [
                    'div',
                    {
                        class: 'yt-play-button',
                        style: 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 68px; height: 68px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);',
                    },
                    [
                        'div',
                        {
                            style: 'width: 0; height: 0; border-top: 14px solid transparent; border-bottom: 14px solid transparent; border-left: 24px solid white; margin-left: 8px;',
                        },
                    ],
                ],
            ],
        ];
    },

    parseHTML() {
        return [
            // Look for our new block-level wrapper first
            {
                tag: 'div[data-youtube-wrapper="true"]',
                getAttrs: (dom) => {
                    const src = dom.getAttribute('data-yt-src');
                    return src ? { src } : false;
                },
            },
            // Fallback to parse the <a> tag directly so the notes you saved 
            // during the previous test don't break
            {
                tag: 'a[data-yt-src]',
                getAttrs: (dom) => {
                    const src = dom.getAttribute('data-yt-src');
                    return src ? { src } : false;
                },
            },
            // Legacy iframe parsers
            { tag: 'iframe[src*="youtube.com"]' },
            { tag: 'iframe[src*="youtu.be"]' },
            { tag: 'iframe[src*="youtube-nocookie.com"]' },
        ];
    },
});