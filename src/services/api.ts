// GA-Mobil/src/services/api.ts
import axios from 'axios';

const api = axios.create({
  // 💡 CANLI SUNUCU ENTEGRASYONU: Mobil uygulama sunucudaki .NET backend ucumuz ile haberleşir
  baseURL: 'https://204.168.249.86:8443/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export default api;