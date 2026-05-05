import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Можно переопределить через переменную Expo:
// EXPO_PUBLIC_API_BASE=http://192.168.1.105:5000/api
// Иначе пытаемся взять хост из Metro/Expo, чтобы работало на телефоне в одной сети.
const fromEnv = (process.env.EXPO_PUBLIC_API_BASE || '').trim();

const inferApiBase = () => {
	if (Platform.OS === 'web') {
		return `${window.location.protocol}//${window.location.hostname}:5000/api`;
	}

	if (Platform.OS === 'android') {
		return 'http://10.0.2.2:5000/api';
	}

	const hostUri =
		Constants.expoConfig?.hostUri ||
		Constants.manifest2?.extra?.expoClient?.hostUri ||
		Constants.manifest?.debuggerHost ||
		'';

	const host = hostUri ? hostUri.split(':')[0] : '';
	return host ? `http://${host}:5000/api` : 'http://127.0.0.1:5000/api';
};

export const API_BASE = fromEnv || inferApiBase();
