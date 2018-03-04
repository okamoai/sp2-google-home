const axios = require('axios')
const format = require('date-fns/format')
const GoogleHome = require('google-home-notifier')
const config = require('../config')

// Google Home 設定
GoogleHome.device('グーグルホーム', 'ja')
GoogleHome.accent('ja')
GoogleHome.ip(config.googleHomeIPAddr)

// API からスケジュールを取得
const getSchedule = (mode = 'regular') => {
  const path = mode === 'seamon' ? 'coop_schedules' : 'schedules'
  const dataName = mode === 'seamon' ? 'details' : mode
  return axios
    .get(path, {
      baseURL: 'https://app.splatoon2.nintendo.net/api/',
      headers: {
        cookie: `iksm_session=${config.splatoon.iksm}`,
      },
    })
    .then(res => res.data[dataName] || [])
    .catch(err => console.log(err))
}

module.exports = {
  getSchedule,
  // Google Home に喋らす
  speech: async text => {
    const command = text.replace(/\s/g, '')
    const now = new Date().getTime()
    const index = command.match(/次|つぎ|next/) ? 1 : 0
    const time = index ? '次' : '今'
    let message = ''
    let mode

    // コマンドの内容から取得対象を決定
    if (command.match(/レギュラー|縄張り|なわばり|ナワバリ|regular/)) {
      mode = 'regular'
    } else if (command.match(/がち|ガチ|gachi/)) {
      mode = 'gachi'
    } else if (command.match(/リーグ|league/)) {
      mode = 'league'
    } else if (command.match(/シャケ|鮭|バイト|サーモン|seamon/)) {
      mode = 'seamon'
    } else {
      GoogleHome.notify('指定の条件が分かりませんでした', () => {})
      return
    }

    const data = await getSchedule(mode)

    if (!data.length) {
      GoogleHome.notify('データの取得に失敗しました', () => {})
      return
    }
    // ガチルール指定の場合、返答内容を変更
    if (mode === 'gachi') {
      let gachi
      if (command.match(/エリア/)) {
        [gachi] = data.filter(game => game.rule.name === 'ガチエリア')
      } else if (command.match(/(ヤグラ|やぐら|櫓)/)) {
        [gachi] = data.filter(game => game.rule.name === 'ガチヤグラ')
      } else if (command.match(/ほこ|ホコ|鉾|矛|鋒/)) {
        [gachi] = data.filter(game => game.rule.name === 'ガチホコバトル')
      } else if (command.match(/あさり|アサリ|浅利/)) {
        [gachi] = data.filter(game => game.rule.name === 'ガチアサリ')
      }
      if (gachi) {
        const startTime = gachi.start_time * 1000
        const endTime = gachi.end_time * 1000
        const start = format(new Date(startTime), 'H時')
        const end = format(new Date(endTime), 'H時')
        const rule = gachi.rule.name
        const stageA = gachi.stage_a.name
        const stageB = gachi.stage_b.name
        if (now >= startTime && now < endTime) {
          message = `${rule}は、${end}まで開催中です。ステージは${stageA}と、${stageB}です`
        } else {
          message = `次の${rule}は、${start}開始、${end}終了、ステージは${stageA}と、${stageB}です`
        }
      }
    }
    // シャケバイトの場合、返答内容を変更
    if (mode === 'seamon') {
      const job = index && now > data[0].start_time * 1000 ? data[0] : data[1]
      const startTime = job.start_time * 1000
      const endTime = job.end_time * 1000
      const start = format(new Date(startTime), 'M月D日H時')
      const end = format(new Date(endTime), 'M月D日H時')
      const stage = job.stage.name
      const weapons = job.weapons.map(weapon => (weapon ? weapon.name : 'ランダム')).join('、')
      const status =
        now >= startTime && now < endTime ? 'ただいまバイト募集中です。' : '次のバイトは'
      message = `${status}${start}開始、${end}終了、ステージは${stage}、支給ブキは${weapons}です`
    }
    // 上記以外は通常の確認
    if (message === '') {
      const start = format(new Date(data[index].start_time * 1000), 'H時')
      const end = format(new Date(data[index].end_time * 1000), 'H時')
      const rule = data[index].rule.name
      const gameMode = data[index].game_mode.name
      const stageA = data[index].stage_a.name
      const stageB = data[index].stage_b.name
      message = `${time}の${gameMode}は${start}開始、${end}終了、ルールは${rule}、ステージは${stageA}と、${stageB}です`
    }
    GoogleHome.notify(message, () => {})
  },
}
