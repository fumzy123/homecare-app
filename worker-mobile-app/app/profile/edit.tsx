import { Redirect } from 'expo-router';

export default function EditProfileScreen() {
  return <Redirect href={{ pathname: '/(tabs)/me', params: { edit: 'personal' } }} />;
}
