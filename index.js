const Botkit = require('botkit')
const cron = require('cron')
const config = require('./config')
const googleHomeSplatoon = require('./actions/splatoon')

const controller = Botkit.slackbot({ debug: true })

// BotKit 起動＆初期処理
const startRTM = () => {
  controller
    .spawn({
      token: config.slack.token,
    })
    .startRTM(err => {
      if (err) {
        throw new Error('Could not connect to Slack')
      }
      // 定期時刻に実行
      new cron.CronJob({
        cronTime: '00 00 00 * * *',
        onTick: () => {
          // セッション切れにならないよう定期的にアクセス
          googleHomeSplatoon.getSchedule()
        },
        start: true,
        timeZone: 'Asia/Tokyo',
      })
    })
}

// Error: Stale RTM connection, closing RTM 対策
controller.on('rtm_open', () => {
  console.info('** The RTM api just connected!')
})
controller.on('rtm_close', () => {
  console.info('** The RTM api just closed')
  startRTM()
})
startRTM()

// チャンネル別にアクションを指定する
const channelActions = (bot, channel, text) => {
  switch (channel) {
    // google-home-splatoon チャンネルのコマンドを解析、APIからステージ情報取得して Google Home に喋らせる
    case config.slack.channel.googleHomeSplatoon:
      googleHomeSplatoon.speech(text)
      break
    default:
  }
}
// Bot のメッセージを処理
controller.on('bot_message', (bot, message) => {
  channelActions(bot, message.channel, message.attachments[0].pretext)
})
// ユーザーのメッセージを処理
controller.hears(['.*'], ['ambient'], (bot, message) => {
  channelActions(bot, message.channel, message.text)
})
