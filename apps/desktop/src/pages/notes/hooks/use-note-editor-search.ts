import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TipTapEditorRef } from "@annota/editor-ui";

interface UseNoteEditorSearchProps {
    editorRef: React.RefObject<TipTapEditorRef | null>;
    toggleFullScreen: () => void;
    noteId?: string;
    initialContent?: string | null;
}

export function useNoteEditorSearch({ editorRef, toggleFullScreen, noteId, initialContent }: UseNoteEditorSearchProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const searchQueryParam = queryParams.get('search') || undefined;

    const handleOpenSearch = useCallback(() => {
        setIsSearching(true);
    }, []);

    const handleCloseSearch = useCallback(() => {
        setIsSearching(false);
        setSearchTerm('');
        setSearchResultCount(0);
        setCurrentSearchIndex(-1);
        editorRef.current?.clearSearch();

        const params = new URLSearchParams(location.search);
        if (params.has('search')) {
            params.delete('search');
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [editorRef, location.search, navigate]);

    const handleSearchTermChange = useCallback((term: string) => {
        setSearchTerm(term);
        if (term.length > 0) {
            editorRef.current?.search(term);
        } else {
            editorRef.current?.clearSearch();
            setSearchResultCount(0);
            setCurrentSearchIndex(-1);
        }
    }, [editorRef]);

    const handleSearchResults = useCallback((count: number, currentIndex: number) => {
        setSearchResultCount(count);
        setCurrentSearchIndex(currentIndex);
    }, []);

    const handleSearchNext = useCallback(() => {
        editorRef.current?.searchNext();
    }, [editorRef]);

    const handleSearchPrev = useCallback(() => {
        editorRef.current?.searchPrev();
    }, [editorRef]);

    // Synchronize search query parameter from URL
    useEffect(() => {
        if (searchQueryParam) {
            setIsSearching(true);
            setSearchTerm(searchQueryParam);
        } else {
            setIsSearching(false);
            setSearchTerm('');
            setSearchResultCount(0);
            setCurrentSearchIndex(-1);
            editorRef.current?.clearSearch();
        }
    }, [noteId, searchQueryParam]);

    // Perform search when editor is ready/content is loaded
    useEffect(() => {
        if (initialContent !== null && isSearching && searchTerm && editorRef.current) {
            const timer = setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.search(searchTerm);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [initialContent, isSearching, searchTerm, editorRef]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                handleOpenSearch();
                window.dispatchEvent(new CustomEvent("focus-editor-search"));
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                toggleFullScreen();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleOpenSearch, toggleFullScreen]);

    return {
        isSearching,
        setIsSearching,
        searchTerm,
        searchResultCount,
        currentSearchIndex,
        handleOpenSearch,
        handleCloseSearch,
        handleSearchTermChange,
        handleSearchResults,
        handleSearchNext,
        handleSearchPrev,
    };
}
