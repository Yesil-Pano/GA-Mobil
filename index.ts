import { registerRootComponent } from 'expo';
import App from './App';

if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error('[GlobalError]', error.message);
    console.error('[Stack]', error.stack);
  });
}

registerRootComponent(App);
