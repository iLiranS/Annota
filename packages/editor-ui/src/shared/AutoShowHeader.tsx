import React, { useEffect, useRef, useState } from 'react';

interface AutoShowHeaderProps {
    children: React.ReactNode;
    scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export const AutoShowHeader: React.FC<AutoShowHeaderProps> = ({ children, scrollContainerRef }) => {
    const [visible, setVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const currentScrollY = container.scrollTop;

            // Hide on scroll down, show on scroll up
            if (currentScrollY <= 50) {
                // Always show near top
                setVisible(true);
            } else if (Math.abs(currentScrollY - lastScrollY.current) < 10) {
                // Ignore small scroll jitters
                return;
            } else if (currentScrollY > lastScrollY.current) {
                // Scrolling down
                setVisible(false);
            } else {
                // Scrolling up
                setVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    return (
        <div
            className="auto-show-header"
            style={{
                position: 'sticky',
                top: 0,
                width: '100%',
                height: 0,
                overflow: 'visible',
                zIndex: 30,
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
                transform: visible ? 'translateY(0)' : 'translateY(-80px)',
                opacity: visible ? 1 : 0,
                pointerEvents: 'none',
            }}
        >
            <div style={{ pointerEvents: 'auto' }}>
                {children}
            </div>
        </div>
    );
};
