const IS_DEV = process.env.APP_VARIANT === 'development';
export default {
  "expo": {
    name: IS_DEV ? 'Annota (Dev)' : 'Annota',
    "slug": "annota",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/images/icon.png",
    "scheme": "annota",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": true,
      bundleIdentifier: IS_DEV ? 'com.anonymous.annota.dev' : 'com.anonymous.annota',
      "icon": {
        "dark": "./assets/images/icon.png",
        "light": "./assets/images/icon.png",
        "tinted": "./assets/images/icon.png"
      },
      "requireFullScreen": true,
      "infoPlist": {
        "BGTaskSchedulerPermittedIdentifiers": [
          "com.expo.modules.backgroundtask.processing"
        ],
        "UIBackgroundModes": [
          "fetch",
          "remote-notification"
        ],
        "UISupportedInterfaceOrientations": [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ]
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false,
      "package": "com.anonymous.annota"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/icon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Annota needs access to your photos to let you attach them to notes.",
          "cameraPermission": "Annota needs access to your camera to let you take photos for your notes."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Allow Annota to access your photos.",
          "savePhotosPermission": "Allow Annota to save photos.",
          "isAccessMediaLocationEnabled": true
        }
      ],
      "@react-native-community/datetimepicker"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}