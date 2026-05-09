export default {
  expo: {
    name: "FieldReportX",
    slug: "FieldReportX",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/reportXlogo.png",
    scheme: "fieldreportx",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    androidStatusBar: {
      backgroundColor: "#00000000",
      translucent: true,
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSSpeechRecognitionUsageDescription:
          "Allow FieldReportX to transcribe speech into report fields.",
        NSMicrophoneUsageDescription:
          "Allow FieldReportX to use the microphone for speech-to-text input.",
      },
    },
    android: {
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      package: "com.fieldreportx.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/reportXlogo.png",
        backgroundColor: "#ffffff",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-sqlite",
      "expo-font",
      "expo-web-browser",
      "expo-sharing",
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow FieldReportX to access your camera to capture report photos.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "Allow FieldReportX to save report photos to your library.",
          savePhotosPermission: "Allow FieldReportX to save photos.",
        },
      ],
      "expo-speech-recognition",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow FieldReportX to access your photo library to upload a company logo.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow FieldReportX to tag report photos with your GPS location.",
        },
      ],
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          icon: "./assets/images/reportXlogo.png",
          color: "#ffffff",
          androidMode: "default",
        },
      ],
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "7575e70d-0858-4153-8b54-83c7c2127c97",
      },
    },
  },
};
