// Demo/test kolaylıkları gerçek dağıtımdan ayrılır.
// Geliştirmede açıktır; yayın derlemesinde kapalıdır. Derlemede `EXPO_PUBLIC_DEMO_TOOLS=1` ile zorla açılabilir.
// Kapalıyken: giriş ekranında "Test hesapları" listesi ve demo verisine bağlı gösterim yoktur.
const flag = process.env.EXPO_PUBLIC_DEMO_TOOLS;

export const DEMO_TOOLS: boolean = flag === undefined ? __DEV__ : flag === '1';
