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
            
            if (currentScrollY <= 20) {
                setVisible(true);
            } else {
                const delta = currentScrollY - lastScrollY.current;
                if (Math.abs(delta) < 10) return;

                setVisible(delta < 0); // Show when scrolling up
                lastScrollY.current = currentScrollY;
            }
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
                zIndex: 50,
                overflow: 'visible',
                pointerEvents: 'none',
            }}
        >
            <div
                style={{
                    width: '100%',
                    transition: 'all 0.3s ease-in-out',
                    transform: visible ? 'translateY(0)' : 'translateY(-20px)',
                    opacity: visible ? 1 : 0,
                    pointerEvents: visible ? 'auto' : 'none',
                }}
            >
                {children}
            </div>
        </div>
    );
};
