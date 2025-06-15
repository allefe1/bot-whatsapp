const socket = io();

// Atualizar status em tempo real
socket.on('status-update', (data) => {
    updateStatus(data.status);
});

socket.on('qr-update', (data) => {
    showQR(data.qr);
    updateStatus(data.status);
});

function updateStatus(status) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = status;
    
    statusEl.className = 'status ';
    if (status === 'Conectado' || status === 'Autenticado') {
        statusEl.className += 'connected';
        document.getElementById('qr-section').style.display = 'none';
    } else if (status === 'Aguardando QR Code') {
        statusEl.className += 'waiting';
        document.getElementById('qr-section').style.display = 'block';
    } else {
        statusEl.className += 'disconnected';
    }
}

function showQR(qrData) {
    if (qrData) {
        document.getElementById('qr-image').src = qrData;
        document.getElementById('qr-section').style.display = 'block';
    }
}

async function refreshQR() {
    try {
        const response = await fetch('/qr');
        const data = await response.json();
        if (data.qr) {
            document.getElementById('qr-image').src = data.qr;
            document.getElementById('qr-section').style.display = 'block';
        }
        updateStatus(data.status);
    } catch (error) {
        console.error('Erro ao atualizar QR:', error);
        showAlert('Erro ao atualizar QR Code', 'error');
    }
}

// ✅ CORRIGIDO: Melhor feedback para reinício
async function restartBot() {
    if (!confirm('Tem certeza que deseja reiniciar o bot?')) return;
    
    // Mostrar loading
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '🔄 Reiniciando...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/bot-control', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ action: 'restart' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Bot reiniciado com sucesso! Aguarde a reconexão...', 'success');
        } else {
            showAlert('Erro: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao reiniciar bot:', error);
        showAlert('Erro ao reiniciar bot', 'error');
    } finally {
        // Restaurar botão após 5 segundos
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 5000);
    }
}

async function pauseBot() {
    try {
        const response = await fetch('/bot-control', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ action: 'pause' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Bot pausado com sucesso!', 'success');
        } else {
            showAlert('Erro: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao pausar bot:', error);
        showAlert('Erro ao pausar bot', 'error');
    }
}

async function resumeBot() {
    try {
        const response = await fetch('/bot-control', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ action: 'resume' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Bot reativado com sucesso!', 'success');
        } else {
            showAlert('Erro: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao reativar bot:', error);
        showAlert('Erro ao reativar bot', 'error');
    }
}

// Carregar configurações
async function loadConfig() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        
        document.getElementById('controlNumber').value = config.controlNumber || '';
        document.getElementById('welcomeMessage').value = config.welcomeMessage;
        document.getElementById('address').value = config.address;
        document.getElementById('operatingHours').value = config.operatingHours;
        document.getElementById('schedulingLink').value = config.schedulingLink;
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showAlert('Erro ao carregar configurações', 'error');
    }
}

// ✅ CORRIGIDO: Melhor feedback para serviços
async function loadServices() {
    // Mostrar loading
    const btn = event?.target;
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '🔄 Carregando...';
        btn.disabled = true;
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }
    
    try {
        const response = await fetch('/services');
        const data = await response.json();
        
        const servicesList = document.getElementById('services-list');
        servicesList.innerHTML = '';
        
        data.services.forEach(service => {
            const serviceEl = document.createElement('div');
            serviceEl.className = 'service-item';
            serviceEl.innerHTML = `
                <div class="service-info">
                    <strong>${service.name}</strong><br>
                    <small>⏱️ ${service.time} | 💵 ${service.price}</small>
                </div>
                <div class="service-actions">
                    <button class="btn small" onclick="editService(${service.id})">✏️ Editar</button>
                    <button class="btn small danger" onclick="deleteService(${service.id})">🗑️ Remover</button>
                </div>
            `;
            servicesList.appendChild(serviceEl);
        });
        
        // ✅ NOVO: Feedback visual
        showAlert(`${data.services.length} serviços carregados com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showAlert('Erro ao carregar serviços', 'error');
    }
}

// Salvar configurações
document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const config = {
        controlNumber: document.getElementById('controlNumber').value,
        welcomeMessage: document.getElementById('welcomeMessage').value,
        address: document.getElementById('address').value,
        operatingHours: document.getElementById('operatingHours').value,
        schedulingLink: document.getElementById('schedulingLink').value
    };
    
    try {
        const response = await fetch('/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Configurações salvas com sucesso!', 'success');
        } else {
            showAlert('Erro ao salvar configurações', 'error');
        }
    } catch (error) {
        showAlert('Erro ao salvar configurações', 'error');
    }
});

// Modal de serviços
function openAddServiceModal() {
    document.getElementById('modalTitle').textContent = 'Adicionar Serviço';
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceName').value = '';
    document.getElementById('serviceTime').value = '';
    document.getElementById('servicePrice').value = '';
    document.getElementById('serviceModal').style.display = 'block';
}

async function editService(id) {
    try {
        const response = await fetch('/services');
        const data = await response.json();
        const service = data.services.find(s => s.id === id);
        
        if (service) {
            document.getElementById('modalTitle').textContent = 'Editar Serviço';
            document.getElementById('serviceId').value = service.id;
            document.getElementById('serviceName').value = service.name;
            document.getElementById('serviceTime').value = service.time;
            document.getElementById('servicePrice').value = service.price;
            document.getElementById('serviceModal').style.display = 'block';
        }
    } catch (error) {
        showAlert('Erro ao carregar serviço', 'error');
    }
}

async function deleteService(id) {
    if (!confirm('Tem certeza que deseja remover este serviço?')) return;
    
    try {
        const response = await fetch(`/services/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Serviço removido com sucesso!', 'success');
            loadServices();
        } else {
            showAlert('Erro: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('Erro ao remover serviço', 'error');
    }
}

function closeServiceModal() {
    document.getElementById('serviceModal').style.display = 'none';
}

// ✅ CORRIGIDO: Melhor feedback ao salvar serviço
document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const serviceData = {
        name: document.getElementById('serviceName').value,
        time: document.getElementById('serviceTime').value,
        price: document.getElementById('servicePrice').value
    };
    
    const serviceId = document.getElementById('serviceId').value;
    
    try {
        let response;
        if (serviceId) {
            // Editar
            response = await fetch(`/services/${serviceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serviceData)
            });
        } else {
            // Adicionar
            response = await fetch('/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serviceData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(serviceId ? 'Serviço atualizado com sucesso!' : 'Serviço adicionado com sucesso!', 'success');
            closeServiceModal();
            loadServices(); // ✅ Recarregar automaticamente
        } else {
            showAlert('Erro: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('Erro ao salvar serviço', 'error');
    }
});

function showAlert(message, type) {
    // Remover alertas existentes
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Criar novo alerta
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    
    // Inserir no início do body
    document.body.insertBefore(alert, document.body.firstChild);
    
    // Remover após 5 segundos
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('serviceModal');
    if (event.target === modal) {
        closeServiceModal();
    }
}

// ✅ NOVA FUNÇÃO: Logout
async function logout() {
    if (!confirm('Tem certeza que deseja sair?')) return;
    
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Erro no logout:', error);
        // Redirecionar mesmo com erro
        window.location.href = '/login';
    }
}

// ✅ NOVO: Verificar autenticação em requisições
const originalFetch = window.fetch;
window.fetch = function(...args) {
    return originalFetch.apply(this, args)
        .then(response => {
            if (response.status === 401) {
                window.location.href = '/login';
            }
            return response;
        });
};

// Carregar dados iniciais
loadConfig();
loadServices();
refreshQR();

// ✅ CORRIGIDO: Reduzir frequência de atualização QR
setInterval(refreshQR, 60000); // A cada 1 minuto em vez de 30 segundos
