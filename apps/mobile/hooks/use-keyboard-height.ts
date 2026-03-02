import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useKeyboardHeight() {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        // Events vary slightly between platforms
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onKeyboardShow = (e: any) => {
            setKeyboardHeight(e.endCoordinates.height);
        };

        const onKeyboardHide = () => {
            setKeyboardHeight(0);
        };

        const showListener = Keyboard.addListener(showEvent, onKeyboardShow);
        const hideListener = Keyboard.addListener(hideEvent, onKeyboardHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    return keyboardHeight;
};

// Usage in a component:
// const keyboardHeight = useKeyboardHeight();
