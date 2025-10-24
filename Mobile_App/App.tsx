import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, Button, Alert, TextInput } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('http://192.168.0.10:3000'); // <- anpassen!
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotifications().then((t) => setToken(t));
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('notification tapped', response);
    });
    return () => { if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current); };
  }, []);

  async function sendTokenToServer() {
    if (!token) return Alert.alert('Kein Token');
    try {
      const res = await fetch(`${serverUrl}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error('Serverfehler');
      Alert.alert('Registriert', 'Gerät erhält künftig Alarme.');
    } catch (e:any) { Alert.alert('Fehler', e.message); }
  }

  async function testLocalNotification() {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'JF Alarm (lokal)', body: 'Dies ist ein Test auf diesem Gerät.', sound: 'default' },
      trigger: null,
    });
  }

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16, gap:12 }}>
      <Text style={{ fontSize:18, fontWeight:'600' }}>JF Alarm App</Text>
      <TextInput
        style={{ width:'100%', borderWidth:1, borderColor:'#ccc', borderRadius:10, padding:10 }}
        placeholder="Server URL (z. B. http://192.168.0.10:3000)"
        value={serverUrl}
        onChangeText={setServerUrl}
      />
      <Text style={{ textAlign:'center' }}>Token: {token ? token : '—'}</Text>
      <Button title="Bei Server registrieren" onPress={sendTokenToServer} />
      <View style={{ height: 12 }} />
      <Button title="Lokal testen (Klingel)" onPress={testLocalNotification} />
    </View>
  );
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Constants.isDevice) { Alert.alert('Nur echte Geräte unterstützen Push.'); return null; }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') { Alert.alert('Benachrichtigungsrechte nicht erteilt'); return null; }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarm-default', {
      name: 'JF Alarm',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}
