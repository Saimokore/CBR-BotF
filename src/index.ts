const { 
  Client, GatewayIntentBits, EmbedBuilder, Events, PermissionFlagsBits, MessageFlags,
  SlashCommandBuilder, REST, Routes, ChannelType
} = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
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
    GatewayIntentBits.MessageContent,
  ]
});

// Estados temporários para fluxos de criação, edição, mensagem, edição mensagem
const estados = {
  criandoComando: new Map(),      // userId => { nomeComando, usarEmbed, cor, channelId }
  editandoComando: new Map(),     // userId => nomeComando
  enviandoMensagem: new Map(),    // userId => { canalId }
  editandoMensagem: new Map(),    // userId => { canalId, mensagemId }
};

async function registrarComandos() {
  const comandos = [
    new SlashCommandBuilder()
      .setName('criarcomando')
      .setDescription('Cria um comando personalizado')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando (sem "!")').setRequired(true))
      .addBooleanOption(opt => opt.setName('usar_embed').setDescription('Usar embed?').setRequired(true))
      .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed (hex) - opcional').setRequired(false)),

    new SlashCommandBuilder()
      .setName('editarcomando')
      .setDescription('Editar mensagem de um comando personalizado')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando para editar').setRequired(true)),

    new SlashCommandBuilder()
      .setName('deletarcomando')
      .setDescription('Deletar um comando personalizado')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando para deletar').setRequired(true)),

    new SlashCommandBuilder()
      .setName('mensagem')
      .setDescription('Fazer o bot enviar uma mensagem em um canal')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal para enviar a mensagem').addChannelTypes(ChannelType.GuildText).setRequired(true)),

    new SlashCommandBuilder()
      .setName('editarmensagem')
      .setDescription('Editar mensagem enviada pelo bot pelo link')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('link').setDescription('Link da mensagem (ex: https://discord.com/channels/guildId/canalId/mensagemId)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Mostrar comandos de administração')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('🚀 Registrando comandos slash...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: comandos.map(c => c.toJSON()) }
    );
    console.log('✅ Comandos registrados!');
  } catch (error) {
    console.error(error);
  }
}

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  registrarComandos();
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const adminCheck = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
    if (!adminCheck) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar comandos slash.', ephemeral: true });
    }

    switch (interaction.commandName) {
      case 'criarcomando': {
        const nomeComando = interaction.options.getString('nome').toLowerCase();
        const usarEmbed = interaction.options.getBoolean('usar_embed');
        let cor = interaction.options.getString('cor');

        if (cor) {
          if (!cor.startsWith('#')) cor = '#' + cor;
          if (!/^#[0-9A-F]{6}$/i.test(cor)) {
            return interaction.reply({ content: '❌ Cor inválida! Use o formato hex, ex: #FF0000', ephemeral: true });
          }
        } else {
          cor = '#0099ff';
        }

        if (comandosCustomizados[nomeComando]) {
          return interaction.reply({ content: `❌ O comando !${nomeComando} já existe.`, ephemeral: true });
        }

        estados.criandoComando.set(interaction.user.id, {
          nomeComando,
          usarEmbed,
          cor,
          channelId: interaction.channelId
        });

        await interaction.reply({ content: `📝 Agora envie a mensagem que o comando !${nomeComando} deve enviar (use emojis e formatação).`, ephemeral: true });
        break;
      }

      case 'editarcomando': {
        const nome = interaction.options.getString('nome').toLowerCase();
        if (!comandosCustomizados[nome]) {
          return interaction.reply({ content: `❌ O comando !${nome} não existe.`, ephemeral: true });
        }
        estados.editandoComando.set(interaction.user.id, nome);
        await interaction.reply({ content: `✏️ Envie a nova mensagem para o comando !${nome}.`, ephemeral: true });
        break;
      }

      case 'deletarcomando': {
        const nome = interaction.options.getString('nome').toLowerCase();
        if (!comandosCustomizados[nome]) {
          return interaction.reply({ content: `❌ O comando !${nome} não existe.`, ephemeral: true });
        }
        delete comandosCustomizados[nome];
        salvarComandos();
        await interaction.reply({ content: `✅ Comando !${nome} deletado com sucesso.`, ephemeral: true });
        break;
      }

      case 'mensagem': {
        const canal = interaction.options.getChannel('canal');
        if (canal.type !== ChannelType.GuildText) {
          return interaction.reply({ content: '❌ Por favor, escolha um canal de texto válido.', ephemeral: true });
        }

        estados.enviandoMensagem.set(interaction.user.id, { canalId: canal.id });
        await interaction.reply({ content: `📝 Agora envie a mensagem que eu devo enviar no canal ${canal}.`, ephemeral: true });
        break;
      }

      case 'editarmensagem': {
        const link = interaction.options.getString('link');
        // Exemplo de link: https://discord.com/channels/guildId/channelId/messageId
        const partes = link.split('/');
        if (partes.length < 7) {
          return interaction.reply({ content: '❌ Link de mensagem inválido.', ephemeral: true });
        }
        const guildIdLink = partes[4];
        const channelIdLink = partes[5];
        const messageIdLink = partes[6];

        if (guildIdLink !== guildId) {
          return interaction.reply({ content: '❌ Esse link não é deste servidor.', ephemeral: true });
        }

        estados.editandoMensagem.set(interaction.user.id, {
          channelId: channelIdLink,
          messageId: messageIdLink
        });

        await interaction.reply({ content: `✏️ Agora envie a nova mensagem para editar a mensagem ${link}`, ephemeral: true });
        break;
      }

      case 'help': {
        const texto = 
`📚 **Comandos de Administração**

/criarcomando - Cria um comando personalizado (inicia fluxo)
/editarcomando - Edita a mensagem de um comando existente
/deletarcomando - Deleta um comando personalizado
/mensagem - Envia uma mensagem do bot em um canal (inicia fluxo)
/editarmensagem - Edita mensagem enviada pelo bot pelo link
/help - Mostra esta ajuda`;

        await interaction.reply({ content: texto, ephemeral: true });
        break;
      }

      default:
        await interaction.reply({ content: '❌ Comando não reconhecido.', ephemeral: true });
    }
  }
});

// Comando !help aberto para todos listando comandos customizados
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.trim() === '!help') {
    const cmds = Object.keys(comandosCustomizados);
    if (cmds.length === 0) {
      return message.channel.send('Nenhum comando customizado criado ainda.');
    }
    const lista = cmds.map(c => `!${c}`).join(', ');
    return message.channel.send(`📘 Comandos customizados: ${lista}`);
  }

  // Fluxos que aguardam mensagens do usuário (apenas para admin)
  if (estados.criandoComando.has(message.author.id)) {
    const estado = estados.criandoComando.get(message.author.id);
    if (message.channel.id !== estado.channelId) return; // só no canal original

    comandosCustomizados[estado.nomeComando] = {
      mensagem: message.content,
      embed: estado.usarEmbed,
      cor: estado.cor
    };
    salvarComandos();
    estados.criandoComando.delete(message.author.id);
    return message.reply(`✅ Comando !${estado.nomeComando} criado com sucesso.`);
  }

  if (estados.editandoComando.has(message.author.id)) {
    const nomeCmd = estados.editandoComando.get(message.author.id);
    comandosCustomizados[nomeCmd].mensagem = message.content;
    salvarComandos();
    estados.editandoComando.delete(message.author.id);
    return message.reply(`✅ Comando !${nomeCmd} editado com sucesso.`);
  }

  if (estados.enviandoMensagem.has(message.author.id)) {
    const { canalId } = estados.enviandoMensagem.get(message.author.id);
    const canal = message.guild.channels.cache.get(canalId);
    if (!canal) {
      estados.enviandoMensagem.delete(message.author.id);
      return message.reply('❌ Canal não encontrado, operação cancelada.');
    }
    canal.send(message.content)
      .then(() => {
        estados.enviandoMensagem.delete(message.author.id);
        message.reply(`✅ Mensagem enviada no canal ${canal}.`);
      })
      .catch(err => {
        message.reply('❌ Erro ao enviar mensagem: ' + err.message);
      });
    return;
  }

  if (estados.editandoMensagem.has(message.author.id)) {
    const { channelId, messageId } = estados.editandoMensagem.get(message.author.id);
    const canal = message.guild.channels.cache.get(channelId);
    if (!canal) {
      estados.editandoMensagem.delete(message.author.id);
      return message.reply('❌ Canal não encontrado, operação cancelada.');
    }
    try {
      const msg = await canal.messages.fetch(messageId);
      await msg.edit(message.content);
      estados.editandoMensagem.delete(message.author.id);
      message.reply('✅ Mensagem editada com sucesso.');
    } catch (err) {
      message.reply('❌ Erro ao editar mensagem: ' + err.message);
    }
    return;
  }

  // Comandos customizados via !nome
  if (message.content.startsWith('!')) {
    const nome = message.content.slice(1).toLowerCase();
    if (comandosCustomizados[nome]) {
      const cmd = comandosCustomizados[nome];
      if (cmd.embed) {
        const embed = new EmbedBuilder().setDescription(cmd.mensagem).setColor(cmd.cor || '#0099ff');
        return message.channel.send({ embeds: [embed] });
      } else {
        return message.channel.send(cmd.mensagem);
      }
    }
  }
});

client.login(token);
