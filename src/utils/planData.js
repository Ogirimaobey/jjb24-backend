const jobPlans = {
    'SW1': { id: 'SW1', name: '4th STREET', price: 8000, daily_income: 400, tasks: 2, duration: 35, image: 'https://i.postimg.cc/RVmDbNMg/image.png' },
    'SW2': { id: 'SW2', name: 'CARLO ROSSI', price: 15000, daily_income: 800, tasks: 2, duration: 35, image: 'https://i.postimg.cc/Bb4RD6b1/image.png' },
    'SW3': { id: 'SW3', name: 'ANDRE', price: 40000, daily_income: 1600, tasks: 5, duration: 40, image: 'https://i.postimg.cc/jdjFrB7C/image.png' },
    'SW4': { id: 'SW4', name: 'VODKA', price: 80000, daily_income: 3200, tasks: 7, duration: 40, image: 'https://i.postimg.cc/Dzcr0wV3/image.png' },
    'SW5': { id: 'SW5', name: 'CHAMDOR', price: 120000, daily_income: 3800, tasks: 10, duration: 50, image: 'https://i.postimg.cc/SR97y7kf/image.png' },
    'SW6': { id: 'SW6', name: 'SANDEMAN RUBY', price: 150000, daily_income: 4400, tasks: 10, duration: 50, image: 'https://i.postimg.cc/90PR8xWz/image.png' },
    'SW7': { id: 'SW7', name: 'ASCONI AGOR', price: 200000, daily_income: 4900, tasks: 10, duration: 60, image: 'https://i.postimg.cc/rFFw2yj9/image.png' },
    'SW8': { id: 'SW8', name: 'IRISH CREAM', price: 300000, daily_income: 6000, tasks: 10, duration: 90, image: 'https://i.postimg.cc/KYXbjmPd/image.png' },
    'SW9': { id: 'SW9', name: 'GLENFFIDDICH', price: 400000, daily_income: 7800, tasks: 10, duration: 90, image: 'https://i.postimg.cc/tgdKgWC9/image.png' },
    'SW10': { id: 'SW10', name: 'MATTEL', price: 500000, daily_income: 9800, tasks: 10, duration: 90, image: 'https://i.postimg.cc/NMzpGjTk/image.png' },
};
const vipPlans = {
    'VIP1': { id: 'VIP1', name: 'CASPER VIP 1', price: 500000, total_return: 600000, duration: 30, image: '' },
    'VIP2': { id: 'VIP2', name: 'CASPER VIP 2', price: 1000000, total_return: 1200000, duration: 30, image: '' },
    'VIP3': { id: 'VIP3', name: 'CASPER VIP 3', price: 2000000, total_return: 2400000, duration: 30, image: '' },
    'VIP4': { id: 'VIP4', name: 'CASPER VIP 4', price: 3000000, total_return: 3600000, duration: 30, image: '' },
};
export const allPlans = { ...jobPlans, ...vipPlans };