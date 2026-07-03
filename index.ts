import { registerRootComponent } from 'expo';
import { enableScreens } from 'react-native-screens';
import App from './App';

enableScreens();

if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error('[GlobalError]', error.message);
    console.error('[Stack]', error.stack);
  });
}

registerRootComponent(App);
