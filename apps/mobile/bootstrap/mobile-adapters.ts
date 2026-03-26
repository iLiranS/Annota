import type { PlatformAdapters } from '@annota/core/platform';
import NetInfo from '@react-native-community/netinfo';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { Action, manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as IntentLauncher from 'expo-intent-launcher';
import * as MediaLibrary from 'expo-media-library';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { AppState, Image, Platform } from 'react-native';
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
                const toastType = type === 'success' ? 'success' : type === 'info' ? 'info' : 'error';
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
            sha256HexUtf8: async (data: string) => {
                const hash = crypto.createHash('sha256');
                hash.update(data, 'utf8');
                return hash.digest('hex') as unknown as string;
            },
            argon2id: async ({ message, nonce, memory, passes, parallelism, tagLength }) => {
                return await new Promise<Uint8Array>((resolve, reject) => {
                    crypto.argon2(
                        'argon2id',
                        {
                            message,
                            nonce,
                            memory,
                            passes,
                            parallelism,
                            tagLength,
                        },
                        (err: Error | null, result: Buffer) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve(new Uint8Array(result));
                        },
                    );
                });
            },
            aes256GcmEncrypt: async ({ key, nonce, plaintext }: { key: Uint8Array; nonce: Uint8Array; plaintext: Uint8Array }) => {
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
            aes256GcmDecrypt: async ({ key, nonce, ciphertext, authTag }: { key: Uint8Array; nonce: Uint8Array; ciphertext: Uint8Array; authTag: Uint8Array }) => {
                const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, nonce as any);
                decipher.setAuthTag(Buffer.from(authTag) as any);

                const decryptedContent = decipher.update(Buffer.from(ciphertext) as any);
                const decryptedFinal = decipher.final();

                return new Uint8Array(Buffer.concat([decryptedContent as any, decryptedFinal as any]));
            },
        },
        fileSystem: {
            ensureDir: async (scope: 'images' | 'cache' | 'files') => {
                const parentPath = (scope === 'images' || scope === 'files') ? FileSystem.Paths.document : FileSystem.Paths.cache;
                const dir = new FileSystem.Directory(parentPath, scope);
                if (!dir.exists) {
                    await dir.create();
                }
                return dir.uri;
            },
            copyFile: async (from: string, to: string) => {
                const sourceFile = new FileSystem.File(from);
                const destFile = new FileSystem.File(to);
                await sourceFile.copy(destFile);
            },
            deleteFile: async (path: string) => {
                const file = new FileSystem.File(path);
                if (file.exists) await file.delete();
            },
            readBase64: async (path: string) => {
                const file = new FileSystem.File(path);
                return await file.base64();
            },
            readBytes: async (path: string) => {
                const file = new FileSystem.File(path);
                return await file.bytes();
            },
            writeBytes: async (path: string, bytes: Uint8Array) => {
                const file = new FileSystem.File(path);
                await file.create({ overwrite: true });
                await file.write(bytes);
            },
            getSize: async (path: string) => {
                const file = new FileSystem.File(path);
                return await file.size;
            },
            downloadToTemp: async (url: string) => {
                const tempDir = new FileSystem.Directory(FileSystem.Paths.cache, 'downloads');
                if (!tempDir.exists) await tempDir.create();

                const downloaded = await FileSystem.File.downloadFileAsync(url, tempDir);

                return {
                    path: downloaded.uri,
                    cleanup: async () => { try { await downloaded.delete(); } catch { } }
                };
            },
            toImageUrl: async (path: string) => {
                const file = new FileSystem.File(path);
                const base64 = await file.base64();
                const mime = path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
                return `data:${mime};base64,${base64}`;
            },
            openFile: async (fileUri: string, mimeType: string = 'application/pdf') => {
                try {
                    if (Platform.OS === 'ios') {
                        await Sharing.shareAsync(fileUri, { UTI: 'com.adobe.pdf' });
                    } else {
                        const contentUri = await FileSystem.getContentUriAsync(fileUri);
                        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                            data: contentUri,
                            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                            type: mimeType,
                        });
                    }
                } catch (error) {
                    console.error("Failed to open file in Expo:", error);
                }
            },
        },
        image: {
            resizeAndCompress: async (sourcePath: string, opts: { maxDimension: number; format: 'jpeg' | 'webp'; quality: number }) => {
                const { width: origW, height: origH } = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                    Image.getSize(sourcePath, (width, height) => resolve({ width, height }), reject);
                });

                const actions: Action[] = [];

                if (origW > opts.maxDimension || origH > opts.maxDimension) {
                    if (origW >= origH) {
                        actions.push({ resize: { width: opts.maxDimension } });
                    } else {
                        actions.push({ resize: { height: opts.maxDimension } });
                    }
                }

                const result = await manipulateAsync(
                    sourcePath,
                    actions,
                    {
                        compress: opts.quality,
                        format: opts.format === 'webp' ? SaveFormat.WEBP : SaveFormat.JPEG,
                    }
                );

                return { path: result.uri, width: result.width, height: result.height };
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
