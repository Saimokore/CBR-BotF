const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { token } = require('./config.json');
const fs = require('fs');
const path = require('path');

const comandosPath = path.join(__dirname, 'comandos.json');
let comandosCustomizados = {};
if (fs.existsSync(comandosPath)) {
  comandosCustomizados = JSON.parse(fs.readFileSync(comandosPath, 'utf8'));
}
function salvarComandos() {
  fs.writeFileSync(comandosPath, JSON.stringify(comandosCustomizados, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // ESSENCIAL para !ping funcionar
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    // ====== CRIAR COMANDO PERSONALIZADO ======
    if (interaction.commandName === 'criarcomando') {
      // Permitir apenas moderadores (cargo com PermissionFlagsBits.ManageMessages)
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem criar comandos.', flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId('criarComandoModal')
        .setTitle('Criar Comando Personalizado');

      const nomeInput = new TextInputBuilder()
        .setCustomId('nomeComandoInput')
        .setLabel('Nome do comando (sem !)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const mensagemInput = new TextInputBuilder()
        .setCustomId('mensagemInput')
        .setLabel('Mensagem ou texto do comando')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const embedInput = new TextInputBuilder()
        .setCustomId('embedInput')
        .setLabel('Embed? (true ou false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const corInput = new TextInputBuilder()
        .setCustomId('corInput')
        .setLabel('Cor do embed (hex) - opcional')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const row1 = new ActionRowBuilder().addComponents(nomeInput);
      const row2 = new ActionRowBuilder().addComponents(mensagemInput);
      const row3 = new ActionRowBuilder().addComponents(embedInput);
      const row4 = new ActionRowBuilder().addComponents(corInput);

      modal.addComponents(row1, row2, row3, row4);

      await interaction.showModal(modal);
    }

    // ====== OUTROS COMANDOS SLASH ======
    else if (interaction.commandName === 'mensagem') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem usar este comando.', ephemeral: true });
      }

      const canal = interaction.options.getChannel('canal');
      const usarEmbed = interaction.options.getBoolean('embed') || false;

      const modal = new ModalBuilder()
        .setCustomId(`mensagemModal|${canal.id}|${usarEmbed}`)
        .setTitle('Enviar Mensagem via Bot');

      const mensagemInput = new TextInputBuilder()
        .setCustomId('mensagemInput')
        .setLabel('Mensagem que o bot vai enviar')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(mensagemInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    else if (interaction.commandName === 'editarmensagem') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem usar este comando.', ephemeral: true });
      }

      const link = interaction.options.getString('link');
      const regex = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
      const match = link.match(regex);

      if (!match) {
        return interaction.reply({ content: '❌ Link inválido.', ephemeral: true });
      }

      const [, guildId, channelId, messageId] = match;

      if (guildId !== interaction.guildId) {
        return interaction.reply({ content: '❌ O link não pertence a este servidor.', ephemeral: true });
      }

      const canal = interaction.guild.channels.cache.get(channelId);
      if (!canal || canal.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      }

      try {
        const mensagem = await canal.messages.fetch(messageId);
        if (mensagem.author.id !== client.user.id) {
          return interaction.reply({ content: '❌ Só posso editar mensagens enviadas pelo bot.', ephemeral: true });
        }

        // Abrir modal para editar conteúdo da mensagem
        const modal = new ModalBuilder()
          .setCustomId(`editarMensagemModal|${channelId}|${messageId}`)
          .setTitle('Editar Mensagem do Bot');

        const conteudoAtual = mensagem.embeds.length > 0
          ? mensagem.embeds[0].description || ''
          : mensagem.content || '';

        const mensagemInput = new TextInputBuilder()
          .setCustomId('mensagemInput')
          .setLabel('Novo conteúdo da mensagem')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(conteudoAtual);

        const row = new ActionRowBuilder().addComponents(mensagemInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } catch {
        return interaction.reply({ content: '❌ Não consegui encontrar essa mensagem.', ephemeral: true });
      }
    }
  }

  // ====== MODAL SUBMIT HANDLERS ======
  else if (interaction.isModalSubmit()) {
    // CRIAR COMANDO PERSONALIZADO
    if (interaction.customId === 'criarComandoModal') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem criar comandos.', flags: MessageFlags.Ephemeral });
      }

      const nomeComando = interaction.fields.getTextInputValue('nomeComandoInput').toLowerCase();
      const mensagem = interaction.fields.getTextInputValue('mensagemInput');
      const embedRaw = interaction.fields.getTextInputValue('embedInput').toLowerCase();
      const corRaw = interaction.fields.getTextInputValue('corInput');

      const embed = embedRaw === 'true';
      const cor = corRaw || '#0099ff';

      comandosCustomizados[nomeComando] = { mensagem, embed, cor };
      salvarComandos();

      await interaction.reply({ content: `✅ Comando \`!${nomeComando}\` criado com sucesso via formulário!`, flags: MessageFlags.Ephemeral });
    }

    // ENVIAR MENSAGEM VIA MODAL
    else if (interaction.customId.startsWith('mensagemModal|')) {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem usar este comando.', ephemeral: true });
      }

      const [_, canalId, usarEmbedRaw] = interaction.customId.split('|');
      const usarEmbed = usarEmbedRaw === 'true';

      const canal = interaction.guild.channels.cache.get(canalId);
      if (!canal || canal.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      }

      const mensagem = interaction.fields.getTextInputValue('mensagemInput');

      try {
        if (usarEmbed) {
          const embed = new EmbedBuilder().setDescription(mensagem).setColor('#0099ff');
          await canal.send({ embeds: [embed] });
        } else {
          await canal.send(mensagem);
        }
        await interaction.reply({ content: `✅ Mensagem enviada em ${canal}.`, ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Não consegui enviar a mensagem neste canal.', ephemeral: true });
      }
    }

    // EDITAR MENSAGEM VIA MODAL
    else if (interaction.customId.startsWith('editarMensagemModal|')) {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Apenas moderadores podem usar este comando.', ephemeral: true });
      }

      const [_, channelId, messageId] = interaction.customId.split('|');
      const canal = interaction.guild.channels.cache.get(channelId);

      if (!canal || canal.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      }

      const novoConteudo = interaction.fields.getTextInputValue('mensagemInput');

      try {
        const mensagem = await canal.messages.fetch(messageId);
        if (mensagem.author.id !== client.user.id) {
          return interaction.reply({ content: '❌ Só posso editar mensagens enviadas pelo bot.', ephemeral: true });
        }

        if (mensagem.embeds.length > 0) {
          // Edita embed
          const embed = new EmbedBuilder().setDescription(novoConteudo).setColor('#0099ff');
          await mensagem.edit({ embeds: [embed] });
        } else {
          // Edita texto normal
          await mensagem.edit(novoConteudo);
        }

        await interaction.reply({ content: '✅ Mensagem editada com sucesso.', ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Falha ao editar a mensagem.', ephemeral: true });
      }
    }
  }
});


client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content === '!ping') {
    return message.channel.send('🏓 Pong!');
  }

  // Comandos personalizados
  const nomeChamado = content.slice(1).toLowerCase();
  if (comandosCustomizados[nomeChamado]) {
    const cmd = comandosCustomizados[nomeChamado];

    if (cmd.embed) {
      const embedMsg = new EmbedBuilder()
        .setDescription(cmd.mensagem)
        .setColor(cmd.cor || '#0099ff');
      return message.channel.send({ embeds: [embedMsg] });
    } else {
      return message.channel.send(cmd.mensagem);
    }
  }
});

client.login(token);
