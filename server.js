const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ✅ NOVO: Configuração de sessão
app.use(session({
    secret: 'barbearia-arretado-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Para desenvolvimento local
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis globais
global.currentQR = null;
global.botStatus = 'Inicializando...';
global.io = io;
global.botClient = null;
global.botPaused = false;

// ✅ NOVO: PIN de acesso (altere para o PIN desejado)
const ACCESS_PIN = '1315'; // Altere para seu PIN

// ✅ NOVO: Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    
    // Se for uma requisição AJAX, retornar erro JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Redirecionar para página de login
    res.redirect('/login');
}

// Configurações globais
global.botConfig = {
    welcomeMessage: "Bem-vindo(a) à *Barbearia Arretado*! 💈",
    address: "Av. Paulistana 2015, Natal, Rio Grande do Norte 59108120",
    operatingHours: "Seg a Sex: 09h as 19h\nSab: 09h as 16h",
    schedulingLink: "https://agendeonline.salonsoft.com.br/arretadobarbearia",
    controlNumber: "",
    services: [
        { id: 1, name: "Barba", time: "20min", price: "a partir de R$ 20,00" },
        { id: 2, name: "Barba na cera (designer)", time: "30min", price: "a partir de R$ 35,00" },
        { id: 3, name: "Barba na cera (remoção total)", time: "40min", price: "a partir de R$ 50,00" },
        { id: 4, name: "Corte de cabelo", time: "40min", price: "a partir de R$ 28,00" },
        { id: 5, name: "Corte + barba + sobrancelha", time: "1h:10min", price: "a partir de R$ 55,00" },
        { id: 6, name: "Corte + barba", time: "1h:00min", price: "a partir de R$ 45,00" },
        { id: 7, name: "Depilação nasal", time: "15min", price: "a partir de R$ 15,00" },
        { id: 8, name: "Hidratação + lavar", time: "10min", price: "a partir de R$ 15,00" },
        { id: 9, name: "Luzes / reflexo", time: "1h:00min", price: "a partir de R$ 45,00" },
        { id: 10, name: "Pigmentação cabelo ou barba", time: "15min", price: "a partir de R$ 18,00" },
        { id: 11, name: "Platinado (nevou)", time: "1h:00min", price: "a partir de R$ 90,00" },
        { id: 12, name: "Relaxamento", time: "20min", price: "a partir de R$ 35,00" },
        { id: 13, name: "Sobrancelhas", time: "10min", price: "a partir de R$ 10,00" },
        { id: 14, name: "Sobrancelhas na cera", time: "25min", price: "a partir de R$ 15,00" }
    ]
};

let lastQRRequest = 0;
const QR_LOG_INTERVAL = 30000;

// ✅ NOVAS ROTAS: Login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { pin } = req.body;
    
    console.log('🔐 Tentativa de login com PIN:', pin);
    
    if (pin === ACCESS_PIN) {
        req.session.authenticated = true;
        console.log('✅ Login autorizado');
        res.json({ success: true, message: 'Login autorizado' });
    } else {
        console.log('❌ PIN incorreto');
        res.status(401).json({ success: false, message: 'PIN incorreto' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    console.log('🚪 Logout realizado');
    res.json({ success: true, message: 'Logout realizado' });
});

// ✅ ROTAS PROTEGIDAS: Aplicar autenticação
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qr', requireAuth, async (req, res) => {
    const now = Date.now();
    if (now - lastQRRequest > QR_LOG_INTERVAL) {
        console.log('📱 Solicitação de QR Code recebida');
        lastQRRequest = now;
    }
    
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

app.get('/config', requireAuth, (req, res) => {
    res.json(global.botConfig);
});

app.post('/config', requireAuth, (req, res) => {
    console.log('📝 Atualizando configurações:', req.body);
    
    global.botConfig = { ...global.botConfig, ...req.body };
    
    console.log('✅ Configurações atualizadas globalmente');
    console.log('   Número de controle:', global.botConfig.controlNumber);
    
    res.json({ success: true, message: 'Configurações atualizadas!' });
});

app.get('/services', requireAuth, (req, res) => {
    console.log('📋 Listando serviços - Total:', global.botConfig.services.length);
    res.json({ services: global.botConfig.services });
});

app.post('/services', requireAuth, (req, res) => {
    const { name, time, price } = req.body;
    console.log('➕ Adicionando serviço:', { name, time, price });
    
    if (!name || !time || !price) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nome, tempo e preço são obrigatórios' 
        });
    }
    
    const newId = Math.max(...global.botConfig.services.map(s => s.id), 0) + 1;
    const newService = { id: newId, name, time, price };
    
    global.botConfig.services.push(newService);
    console.log('✅ Serviço adicionado com ID:', newId);
    
    res.json({ 
        success: true, 
        message: 'Serviço adicionado com sucesso!', 
        service: newService 
    });
});

app.put('/services/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { name, time, price } = req.body;
    console.log('✏️ Editando serviço ID:', id, 'Dados:', { name, time, price });
    
    const serviceIndex = global.botConfig.services.findIndex(s => s.id == id);
    
    if (serviceIndex === -1) {
        console.log('❌ Serviço não encontrado:', id);
        return res.status(404).json({ 
            success: false, 
            message: 'Serviço não encontrado' 
        });
    }
    
    global.botConfig.services[serviceIndex] = { 
        id: parseInt(id), 
        name, 
        time, 
        price 
    };
    
    console.log('✅ Serviço atualizado:', global.botConfig.services[serviceIndex]);
    
    res.json({ 
        success: true, 
        message: 'Serviço atualizado com sucesso!', 
        service: global.botConfig.services[serviceIndex] 
    });
});

app.delete('/services/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    console.log('🗑️ Removendo serviço ID:', id);
    
    const serviceIndex = global.botConfig.services.findIndex(s => s.id == id);
    
    if (serviceIndex === -1) {
        console.log('❌ Serviço não encontrado para remoção:', id);
        return res.status(404).json({ 
            success: false, 
            message: 'Serviço não encontrado' 
        });
    }
    
    const deletedService = global.botConfig.services.splice(serviceIndex, 1)[0];
    console.log('✅ Serviço removido:', deletedService);
    
    res.json({ 
        success: true, 
        message: 'Serviço removido com sucesso!', 
        service: deletedService 
    });
});

app.post('/bot-control', requireAuth, async (req, res) => {
    const { action } = req.body;
    console.log('🎮 Comando de controle recebido:', action);
    
    try {
        if (action === 'restart') {
            console.log('🔄 Iniciando processo de reinício do bot...');
            
            if (global.botClient) {
                console.log('🔄 Destruindo cliente atual...');
                try {
                    await global.botClient.destroy();
                    console.log('✅ Cliente anterior destruído com sucesso');
                } catch (error) {
                    console.log('⚠️ Erro ao destruir cliente:', error.message);
                }
                global.botClient = null;
            }
            
            global.currentQR = null;
            global.botStatus = 'Reiniciando...';
            global.botPaused = false;
            
            if (global.io) {
                global.io.emit('status-update', { status: 'Reiniciando...' });
            }
            
            setTimeout(() => {
                console.log('🚀 Reiniciando bot...');
                try {
                    delete require.cache[require.resolve('./robo')];
                    require('./robo');
                    console.log('✅ Bot reiniciado com sucesso');
                } catch (error) {
                    console.error('❌ Erro ao reiniciar bot:', error);
                    global.botStatus = 'Erro no reinício';
                    if (global.io) {
                        global.io.emit('status-update', { status: 'Erro no reinício' });
                    }
                }
            }, 3000);
            
            res.json({ success: true, message: 'Bot reiniciado com sucesso!' });
            
        } else if (action === 'pause') {
            console.log('⏸️ Pausando bot...');
            
            global.botPaused = true;
            global.botStatus = 'Pausado manualmente';
            
            if (global.io) {
                global.io.emit('status-update', { status: 'Pausado manualmente' });
            }
            
            res.json({ success: true, message: 'Bot pausado com sucesso!' });
            
        } else if (action === 'resume') {
            console.log('▶️ Reativando bot...');
            
            global.botPaused = false;
            global.botStatus = 'Ativo';
            
            if (global.io) {
                global.io.emit('status-update', { status: 'Ativo' });
            }
            
            res.json({ success: true, message: 'Bot reativado com sucesso!' });
            
        } else {
            console.log('❌ Ação inválida recebida:', action);
            res.status(400).json({ success: false, message: 'Ação inválida' });
        }
    } catch (error) {
        console.error('❌ Erro no controle do bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        bot: global.botStatus,
        hasQR: !!global.currentQR,
        timestamp: new Date().toISOString()
    });
});

// ✅ NOVO: Socket.IO com autenticação
io.use((socket, next) => {
    // Verificar se a sessão está autenticada
    const sessionId = socket.handshake.headers.cookie;
    if (sessionId) {
        // Em produção, você pode verificar a sessão aqui
        next();
    } else {
        next(new Error('Não autorizado'));
    }
});

io.on('connection', (socket) => {
    console.log('🌐 Cliente autenticado conectado à interface web');
    
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
    console.log(`🔐 PIN de acesso: ${ACCESS_PIN}`);
});

// Iniciar bot
setTimeout(() => {
    console.log('🤖 Iniciando bot WhatsApp...');
    require('./robo');
}, 2000);
