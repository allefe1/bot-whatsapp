const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ IMPORTANTE: Para processar POST

// Variáveis globais para compartilhar com o bot
global.currentQR = null;
global.botStatus = 'Inicializando...';
global.io = io;
global.botClient = null; // ✅ NOVO: Referência para o cliente do bot

// Configurações editáveis
let botConfig = {
    services: [
        { name: "Barba", time: "20min", price: "a partir de R$ 20,00" },
        { name: "Barba na cera (designer)", time: "30min", price: "a partir de R$ 35,00" },
        { name: "Barba na cera (remoção total)", time: "40min", price: "a partir de R$ 50,00" },
        { name: "Corte de cabelo", time: "40min", price: "a partir de R$ 28,00" },
        { name: "Corte + barba + sobrancelha", time: "1h:10min", price: "a partir de R$ 55,00" },
        { name: "Corte + barba", time: "1h:00min", price: "a partir de R$ 45,00" },
        { name: "Depilação nasal", time: "15min", price: "a partir de R$ 15,00" },
        { name: "Hidratação + lavar", time: "10min", price: "a partir de R$ 15,00" },
        { name: "Luzes / reflexo", time: "1h:00min", price: "a partir de R$ 45,00" },
        { name: "Pigmentação cabelo ou barba", time: "15min", price: "a partir de R$ 18,00" },
        { name: "Platinado (nevou)", time: "1h:00min", price: "a partir de R$ 90,00" },
        { name: "Relaxamento", time: "20min", price: "a partir de R$ 35,00" },
        { name: "Sobrancelhas", time: "10min", price: "a partir de R$ 10,00" },
        { name: "Sobrancelhas na cera", time: "25min", price: "a partir de R$ 15,00" }
    ],
    address: "Av. Paulistana 2015, Natal, Rio Grande do Norte 59108120",
    operatingHours: "Seg a Sex: 09h as 19h\nSab: 09h as 16h",
    schedulingLink: "https://agendeonline.salonsoft.com.br/arretadobarbearia",
    welcomeMessage: "Bem-vindo(a) à *Barbearia Arretado*! 💈"
};

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qr', async (req, res) => {
    console.log('📱 Solicitação de QR Code recebida');
    console.log('QR atual:', global.currentQR ? 'Disponível' : 'Não disponível');
    console.log('Status bot:', global.botStatus);
    
    if (global.currentQR) {
        try {
            const qrImage = await QRCode.toDataURL(global.currentQR);
            res.json({ 
                qr: qrImage, 
                status: global.botStatus,
                hasQR: true 
            });
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
            res.json({ 
                error: 'Erro ao gerar QR Code', 
                status: global.botStatus,
                hasQR: false 
            });
        }
    } else {
        res.json({ 
            message: 'QR Code não disponível', 
            status: global.botStatus,
            hasQR: false 
        });
    }
});

app.get('/config', (req, res) => {
    res.json(botConfig);
});

app.post('/config', (req, res) => {
    console.log('📝 Atualizando configurações:', req.body);
    botConfig = { ...botConfig, ...req.body };
    res.json({ success: true, message: 'Configurações atualizadas!' });
});

// ✅ NOVA ROTA: Controle do bot
app.post('/bot-control', async (req, res) => {
    const { action } = req.body;
    console.log('🎮 Comando recebido:', action);
    
    try {
        if (action === 'restart') {
            console.log('🔄 Reiniciando bot...');
            
            if (global.botClient) {
                await global.botClient.destroy();
                console.log('Bot anterior destruído');
            }
            
            // Reinicializar bot
            setTimeout(() => {
                console.log('Reiniciando bot em 3 segundos...');
                require('./robo');
            }, 3000);
            
            global.botStatus = 'Reiniciando...';
            if (global.io) {
                global.io.emit('status-update', { status: 'Reiniciando...' });
            }
            
            res.json({ success: true, message: 'Bot reiniciado!' });
            
        } else if (action === 'pause') {
            console.log('⏸️ Pausando bot...');
            
            // Pausar bot via variável global
            global.botPaused = true;
            global.botStatus = 'Pausado manualmente';
            
            if (global.io) {
                global.io.emit('status-update', { status: 'Pausado manualmente' });
            }
            
            res.json({ success: true, message: 'Bot pausado!' });
            
        } else if (action === 'resume') {
            console.log('▶️ Reativando bot...');
            
            global.botPaused = false;
            global.botStatus = 'Ativo';
            
            if (global.io) {
                global.io.emit('status-update', { status: 'Ativo' });
            }
            
            res.json({ success: true, message: 'Bot reativado!' });
            
        } else {
            res.status(400).json({ success: false, message: 'Ação inválida' });
        }
    } catch (error) {
        console.error('❌ Erro no controle do bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        bot: global.botStatus,
        hasQR: !!global.currentQR,
        timestamp: new Date().toISOString()
    });
});

// Socket.IO para atualizações em tempo real
io.on('connection', (socket) => {
    console.log('🌐 Cliente conectado à interface web');
    
    socket.emit('status-update', { 
        status: global.botStatus,
        hasQR: !!global.currentQR
    });
    
    if (global.currentQR) {
        QRCode.toDataURL(global.currentQR).then(qrImage => {
            socket.emit('qr-update', { 
                qr: qrImage, 
                status: global.botStatus 
            });
        }).catch(err => {
            console.error('Erro ao enviar QR via socket:', err);
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Interface web rodando em http://localhost:${PORT}`);
});

// Iniciar bot após servidor web
setTimeout(() => {
    console.log('🤖 Iniciando bot WhatsApp...');
    require('./robo');
}, 2000);

module.exports = { botConfig };
