# Use a imagem Zenika com Puppeteer já configurado
FROM zenika/alpine-chrome:with-puppeteer

# Definir diretório de trabalho
WORKDIR /usr/src/app

# Mudar para usuário chrome (não-root)
USER chrome

# Copiar package.json e package-lock.json
COPY --chown=chrome:chrome package*.json ./

# Instalar dependências
RUN npm install

# Copiar código da aplicação
COPY --chown=chrome:chrome . .

# ✅ NOVO: Criar diretório para sessão com permissões corretas
RUN mkdir -p .wwebjs_auth logs public

# Expor porta para interface web
EXPOSE 3000

# ✅ MUDANÇA: Iniciar servidor web que inclui o bot
CMD ["node", "server.js"]
