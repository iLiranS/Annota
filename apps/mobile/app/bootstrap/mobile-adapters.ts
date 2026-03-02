import type { PlatformAdapters } from '@annota/core/platform';
import NetInfo from '@react-native-community/netinfo';
import { Buffer } from 'buffer';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import crypto from 'react-native-quick-crypto';
import Toast from 'react-native-toast-message';

export function createMobileAdapters(): PlatformAdapters {
    return {
        network: {
            subscribe: (onChange: (isOnline: boolean) => void) => {
                return NetInfo.addEventListener((state) => {
                    onChange(!!state.isConnected && !!state.isInternetReachable);
                });
            },
        },
        appState: {
            subscribe: (onChange: (isActive: boolean) => void) => {
                const subscription = AppState.addEventListener('change', (state) => {
                    onChange(state === 'active');
                });
                return () => subscription.remove();
            },
        },
        toast: {
            show: ({ type, title, message }: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => {
                const toastType = type === 'success' ? 'onlineToast' : type === 'info' ? 'offlineToast' : 'errorToast';
                Toast.show({
                    type: toastType,
                    text1: title,
                    text2: message,
                    autoHide: true,
                    visibilityTime: 4000,
                    position: 'bottom',
                });
            },
        },
        secureStore: {
            setItem: async (key: string, value: string) => {
                await SecureStore.setItemAsync(key, value, {
                    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                });
            },
            getItem: async (key: string) => {
                return await SecureStore.getItemAsync(key);
            },
            removeItem: async (key: string) => {
                await SecureStore.deleteItemAsync(key);
            },
        },
        crypto: {
            randomBytes: (size: number) => {
                return new Uint8Array(crypto.randomBytes(size));
            },
            sha256HexUtf8: (data: string) => {
                const hash = crypto.createHash('sha256');
                hash.update(data, 'utf8');
                return hash.digest('hex') as unknown as string;
            },
            aes256GcmEncrypt: ({ key, nonce, plaintext }: { key: Uint8Array; nonce: Uint8Array; plaintext: Uint8Array }) => {
                const cipher = crypto.createCipheriv('aes-256-gcm', key as any, nonce as any);
                const encryptedContent = cipher.update(Buffer.from(plaintext) as any);
                const encryptedFinal = cipher.final();
                const authTag = cipher.getAuthTag();

                const ciphertext = Buffer.concat([encryptedContent as any, encryptedFinal as any]);
                return {
                    ciphertext: new Uint8Array(ciphertext),
                    authTag: new Uint8Array(authTag),
                };
            },
            aes256GcmDecrypt: ({ key, nonce, ciphertext, authTag }: { key: Uint8Array; nonce: Uint8Array; ciphertext: Uint8Array; authTag: Uint8Array }) => {
                const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, nonce as any);
                decipher.setAuthTag(Buffer.from(authTag) as any);

                const decryptedContent = decipher.update(Buffer.from(ciphertext) as any);
                const decryptedFinal = decipher.final();

                return new Uint8Array(Buffer.concat([decryptedContent as any, decryptedFinal as any]));
            },
        },
        fileSystem: {
            ensureDir: async (scope: 'images' | 'cache') => {
                const parentPath = scope === 'images' ? Paths.document : Paths.cache;
                const dir = new Directory(parentPath, scope);
                if (!dir.exists) {
                    dir.create();
                }
                return dir.uri;
            },
            copyFile: async (from: string, to: string) => {
                const sourceFile = new ExpoFile(from);
                const destFile = new ExpoFile(to);
                sourceFile.copy(destFile);
            },
            deleteFile: async (path: string) => {
                const file = new ExpoFile(path);
                if (file.exists) file.delete();
            },
            readBase64: async (path: string) => {
                const file = new ExpoFile(path);
                return await file.base64();
            },
            readBytes: async (path: string) => {
                const file = new ExpoFile(path);
                return await file.bytes();
            },
            writeBytes: async (path: string, bytes: Uint8Array) => {
                const file = new ExpoFile(path);
                file.create({ overwrite: true });
                file.write(bytes);
            },
            getSize: async (path: string) => {
                const file = new ExpoFile(path);
                return file.size;
            },
            downloadToTemp: async (url: string) => {
                const tempDir = new Directory(Paths.cache, 'downloads');
                if (!tempDir.exists) tempDir.create();

                const downloaded = await ExpoFile.downloadFileAsync(url, tempDir);
                return {
                    path: downloaded.uri,
                    cleanup: async () => { try { downloaded.delete(); } catch { } }
                };
            },
        },
        image: {
            resizeAndCompress: async (sourcePath: string, opts: { maxDimension: number; format: 'jpeg' | 'webp'; quality: number }) => {
                let manipulated = ImageManipulator.manipulate(sourcePath);
                const original = await manipulated.renderAsync();
                const { width: origW, height: origH } = await original.saveAsync({ format: SaveFormat.WEBP, compress: 1 });

                if (origW > opts.maxDimension || origH > opts.maxDimension) {
                    if (origW >= origH) {
                        manipulated = manipulated.resize({ width: opts.maxDimension });
                    } else {
                        manipulated = manipulated.resize({ height: opts.maxDimension });
                    }
                }

                const rendered = await manipulated.renderAsync();
                const saved = await rendered.saveAsync({
                    format: opts.format === 'webp' ? SaveFormat.WEBP : SaveFormat.JPEG,
                    compress: opts.quality,
                });

                return { path: saved.uri, width: saved.width, height: saved.height };
            },
            requestGalleryPermission: async () => {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                return status === 'granted';
            },
            saveToGallery: async (path: string) => {
                try {
                    await MediaLibrary.saveToLibraryAsync(path);
                    return true;
                } catch {
                    return false;
                }
            },
        },
    };
}
