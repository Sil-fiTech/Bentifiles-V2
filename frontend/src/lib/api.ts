import axios from 'axios';
const ambiente = process.env.AMBIENTE == 'DEV' ? 'http://localhost:4000' : process.env.NEXT_PUBLIC_API_URL;


const api = axios.create({
    baseURL: ambiente,
});

export default api;
