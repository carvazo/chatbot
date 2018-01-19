/* -----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework.
----------------------------------------------------------------------------- */

var restify = require('restify')
var builder = require('botbuilder')
var http = require('http')
var request = require('request')
var entities = require('html-entities')

// Setup Restify Server
var server = restify.createServer()
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url)
})

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword,
  stateEndpoint: process.env.BotStateEndpoint,
  openIdMetadata: process.env.BotOpenIdMetadata
})

// Listen for messages from users
server.post('/api/messages', connector.listen())

/* ----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot.
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

// Create your bot with a function to receive messages from the user

var fQnAMaker = function (session, iQuestion) {
    // definitions
  var lQnaMakerServiceEndpoint = 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/'
  var lQnaApi = 'generateanswer'
  var lKnowledgeBaseId = '072cd326-137b-4705-b735-8b0a2dd99cf4'
  var lSubscriptionKey = '15745d9b221e41c593222171882b6efa'
  var lHtmlentities = new entities.AllHtmlEntities()
  var lKbUri = lQnaMakerServiceEndpoint + lKnowledgeBaseId + '/' + lQnaApi
  request({
    url: lKbUri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': lSubscriptionKey
    },
    body: '{"question":"' + iQuestion + '"}'
  },
    function (error, response, body) {
      var lResult
      var stopQNA
      if (!error) {
        lResult = JSON.parse(body)
        lResult.answer = lHtmlentities.decode(lResult.answer)
      } else {
        lResult.answer = 'Unfortunately an error occurred. Try again.(fQnAMaker)'
        lResult.score = 0
      }

      session.send(lResult.answer)
      session.send('처음으로 돌아가고 싶으신 경우 "홈"을 입력해주세요')
    })
}

var bot = new builder.UniversalBot(connector, [

  function (session, results, next) {
    if (session.message.text == '홈') {
      var cards = getCardAttachments()
      var reply = new builder.Message(session)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards)
      session.send(reply)
      builder.Prompts.text(session, '원하는 타입의 옵션을 선택하시기 바랍니다!')
    } else {
            // session.dialogData = {};
      next(session, results)
    }
  },
  function (session, results) {
    session.dialogData = {}
    session.dialogData.select = {}
    session.dialogData.select.type = session.message.text

    if (session.dialogData.select.type == '1') {
      session.userData.early = {}
            // session.beginDialog('softbyEvent');
      session.beginDialog('earlyCarSearch', session.userData.early)
    } else if (session.dialogData.select.type == '2') {
            // session.beginDialog('softbyPrice');
      session.beginDialog('reservation', session.userData.early)
    } else if (session.dialogData.select.type == '3') {
            // session.beginDialog('softbyFlowerType');
      session.beginDialog('askFAQ', session.userData.early)
    } else {
            // session.send("You said: %s", session.message.text);
      session.send('고객센터로 문의 바랍니다. ( 070-7707-3737 )')
    }
  }

    // function (session, results){

    //     session.userData.early = results.response;

    //     if(session.userData.early.type == "ealry")
    //     {
    //         // console.log(session.userData.early);

    //     }
    //     else if(session.userData.early.type == 'reservation')
    //     {
    //         console.log(session.userData.early);
    //     }
    //     else
    //     {
    //         console.log("else" + session.userData.early);

    //     }

    //     // session.beginDialog('welcome');
    //     // bot.beginDialog(session, 'welcome');
    // }

])

bot.on('conversationUpdate', function (message) {
  if (message.membersAdded) {
    message.membersAdded.forEach(function (identity) {
      if (identity.id === message.address.bot.id) {
                // console.log('req');

        var reply = new builder.Message()
                .address(message.address)
                .text('안녕하세요, 만나서 반갑습니다!')
        bot.send(reply)
        bot.beginDialog(message.address, 'welcome')
      }
    })
  }
})

bot.dialog('welcome', [
  function (session) {
    var cards = getCardAttachments()
    var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards)
    session.send(reply)
    builder.Prompts.text(session, '원하는 내용을 선택하시기 바랍니다!')
  }, function (session, results) {
    session.endDialogWithResult({response: results.response})
  }
])

// 차량 사전 조회
bot.dialog('earlyCarSearch', [

  function (session, args) {
    session.dialogData.early = args || {}
    builder.Prompts.text(session, '차량번호를 남겨주시면 확인후 조회를 해드리도록 하겠습니다')
  },
  function (session, results, next) {
        // var carNumber = results.response;

    if (!car_num_chk(results.response)) {
      session.send('차량번호가 올바르지 않아요.')
      next({ resumed: builder.ResumeReason.back })
    } else {
      session.dialogData.early.carNumber = results.response
      builder.Prompts.text(session, '고객님의 성함을 알려주세요')
    }
  },
  function (session, results) {
    console.log(session.dialogData.early)
    session.dialogData.early.userName = results.response
    builder.Prompts.text(session, '연락받으실 휴대폰번호를 알려주세요. (예시) 010-1234-5678')
  },
  function (session, results, next) {
    if (!validate_phone(results.response)) {
      session.send('휴대폰 번호는 010-1234-5678 혹은 01012345678 형태여야 합니다.')
      next({ resumed: builder.ResumeReason.back })
    } else {
      session.dialogData.early.phoneNumber = results.response
      session.send('감사합니다. 차량을 조회하고 연락드리도록 하겠습니다.')
      session.dialogData.early.type = 'ealry'
            // console.log('sending...');
            // console.log(session.dialogData);
      sendEalryAccess(session.dialogData.early)

      session.send('처음으로 돌아가고 싶으신 경우 "홈"을 입력해주세요')
      session.endDialogWithResult({response: session.dialogData.early})
    }
  }
])

// 예약관련문의
bot.dialog('reservation', [
  function (session, args) {
    session.dialogData.reservation = args || {}
    builder.Prompts.text(session, '예약을 위해 성함을 알려주세요.')
  },
  function (session, results) {
    session.dialogData.reservation.userName = results.response
    builder.Prompts.text(session, '예약을 위한 휴대폰번호를 알려주세요. (예시) 010-1234-5678')
  },
  function (session, results, next) {
    if (!validate_phone(results.response)) {
      session.send('휴대폰 번호는 010-1234-5678 혹은 01012345678 형태여야 합니다.')
      next({ resumed: builder.ResumeReason.back })
    } else {
      session.dialogData.reservation.phone = results.response
      builder.Prompts.choice(session, '차량은 미리 선정하셨나요?', '예|아니오', { listStyle: builder.ListStyle.button })
    }
  },
  function (session, results) {
        // session.dialogData.reservation.phone = results.response;
    console.log(results.response)

    if (results.response.index == 0) {
      builder.Prompts.choice(session, '차량은 국산차이신가요? 수입차 이신가요?', '국산|수입', { listStyle: builder.ListStyle.button })
            // builder.Prompts.text(session,'차량은 국산차이신가요? 수입차 이신가요?');
    } else {
      session.endDialog('차보고 오세요.')
    }
  },
  function (session, results) {
    session.dialogData.reservation.carType = results.response.entity
    console.log(session.dialogData.reservation.carType)

    if (results.response.index == 0) {
            // builder.Prompts.text(session,'국산차량의 점검 금액은 88,000원(부가세 포함)입니다. 예약을 진행해 드릴까요?');
      builder.Prompts.choice(session, '국산차량의 점검 금액은 88,000원(부가세 포함)입니다. 예약을 진행해 드릴까요?', '예|아니오', { listStyle: builder.ListStyle.button })
    } if (results.response.index == 1) {
            // builder.Prompts.text(session,'수입차량의 점검 금액은 132,000원(부가세 포함)입니다. 예약을 진행해 드릴까요?');
      builder.Prompts.choice(session, '수입차량의 점검 금액은 132,000원(부가세 포함)입니다. 예약을 진행해 드릴까요?', '예|아니오', { listStyle: builder.ListStyle.button })
    }
  },
  function (session, results) {
        // session.dialogData.reservation.phone = results.response;
    if (results.response.index == 0) {
            // builder.Prompts.text(session,'차량을 보러가시는 장소는 어디이신가요? (서울, 인천, 경기, 대전, 대구, 부산, 광주)');
      builder.Prompts.choice(session, '차량을 보러가시는 장소는 어디이신가요?', '서울|분당(용인)|경기|수도권|기타 지역', {listStyle: builder.ListStyle.button})
    } else {
      session.endDialog('다음에 이용해주세요~.')
    }
  },
  function (session, results, next) {
    session.dialogData.reservation.area = results.response.index
    if (results.response.index == 0) {
      builder.Prompts.choice(session, '다음의 지역중 어디이신가요?', '강남|성동|강서|강북|강동', {listStyle: builder.ListStyle.button})
    } else if (results.response.index == 1) {
      session.dialogData.reservation.area = '0000000021'
      next()
    } else if (results.response.index == 2) {
      builder.Prompts.choice(session, '다음의 지역중 어디이신가요?', '수원|인천|부천|일산|안산', {listStyle: builder.ListStyle.button})
    } else if (results.response.index == 3) {
      session.dialogData.reservation.area = '0000000014'
      next()
    } else if (results.response.index == 4) {
      session.dialogData.reservation.temp = 4
      builder.Prompts.choice(session, '다음의 지역중 어디이신가요?', '대전|대구|광주|부산', {listStyle: builder.ListStyle.button})
    }
        // session.dialogData.reservation.area = results.response;
        // builder.Prompts.text(session,'${session.dialogData.reservation.area}지역에 어느구 이신가요?');
  },
  function (session, results, next) {
    console.log(session.dialogData.reservation.area)
    if (session.dialogData.reservation.area == 0) {
      if (results.response.entity == '강남') {
        session.dialogData.reservation.area = '0000000004'
      }
      if (results.response.entity == '성동') {
        session.dialogData.reservation.area = '0000000020'
      }
      if (results.response.entity == '강서') {
        session.dialogData.reservation.area = '0000000006'
      }
      if (results.response.entity == '강북') {
        session.dialogData.reservation.area = '0000000005'
      }
      if (results.response.entity == '강동') {
        session.dialogData.reservation.area = '0000000007'
      }
      console.log(session.dialogData.reservation.area)
      next()
    }
    if (session.dialogData.reservation.area == 2) {
      if (results.response.entity == '수원') {
        session.dialogData.reservation.area = '0000000012'
      }
      if (results.response.entity == '인천') {
        session.dialogData.reservation.area = '0000000008'
      }
      if (results.response.entity == '부천') {
        session.dialogData.reservation.area = '0000000011'
      }
      if (results.response.entity == '일산') {
        session.dialogData.reservation.area = '0000000013'
      }
      if (results.response.entity == '안산') {
        session.dialogData.reservation.area = '0000000015'
      }
      console.log(session.dialogData.reservation.area)
      next()
    }
    if (session.dialogData.reservation.area == 4) {
      if (results.response.entity == '대전') {
        session.dialogData.reservation.area = '0000000016'
      }
      if (results.response.entity == '대구') {
        session.dialogData.reservation.area = '0000000017'
      }
      if (results.response.entity == '광주') {
        session.dialogData.reservation.area = '0000000018'
      }
      if (results.response.entity == '부산') {
        session.dialogData.reservation.area = '0000000019'
      }
      console.log(session.dialogData.reservation.area)
      next()
    } else {
      next()
    }
  },
  function (session) {
        // session.dialogData.reservation.areaDetail = results.response;
    var date_ar = []
    for (var i = 1; i <= 7; i++) {
      date_ar.push(caldate(i))
    }
    var date_str = date_ar.join('|')
        // builder.Prompts.text(session,'현재 예약가능한 날짜는 (D+7)일까지 입니다. 차량을 보러가시는 날짜는 언제이신가요? (카드입력)');
    builder.Prompts.choice(session, '현재 예약가능한 날짜는 (D+7)일까지 입니다. 차량을 보러가시는 날짜는 언제이신가요?', date_str, { listStyle: builder.ListStyle.button })
  },
  function (session, results) {
    var select_date = results.response.entity
    session.dialogData.reservation.date = results.select_date

    var cards = getMechanicList()

    var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards)
    session.send(reply)
    builder.Prompts.text(session, '원하는 정비사를 선택하시기 바랍니다!')
  }

])

bot.dialog('askFAQ', [
  function (session) {
    builder.Prompts.text(session, '무엇이든 물어보세요!')
    // saveSession = session
  },
  function (session, results) {
        // pass question to QnAMaker
    var lQuestion = results.response
    fQnAMaker(session, lQuestion)

    session.endDialog()
  }
    // function(session, results){

    //     if(results.response == '그만'){
    //         session.send('처음으로 돌아가고 싶으신 경우 "홈"을 입력해주세요');
    //         session.endDialog();
    //     }
    // }

])

function getMechanicList (session) {
  var data_json = '{"data":[{"profile":"https:\/\/app.carvazo.com\/files\/store\/2016\/1207\/41d135924feebe17be85ab84ac11f9c1_FThumb.jpg","name":"\uad8c\uacbd\ud68c","area":"\uc11c\uc6b8 \uac15\uc11c\uc9c0\uc5ed, \uc11c\uc6b8 \uac15\ub0a8\uc9c0\uc5ed \ub4f1","rating":"5.0","description":"\uc804\uad6d\uae30\ub2a5\uacbd\uae30\ub300\ud68c \uc790\ub3d9\ucc28\ubd80\ubd84 \uba54\ub2ec \uc218\uc0c1","reservation_url":"https:\/\/www.carvazo.com\/\uad8c\uacbd\ud68c\uc815\ube44\uc0ac"},{"profile":"https:\/\/app.carvazo.com\/files\/store\/2017\/0616\/d9cda0b9aa0b3adebba70578219f9e06_FThumb.jpg","name":"\uc774\ud6a8\uc900","area":"\uc218\ub3c4\uad8c \uae30\ud0c0\uc9c0\uc5ed, \uc11c\uc6b8 \uac15\uc11c\uc9c0\uc5ed \ub4f1","rating":"5.0","description":"\uc544\uc6b0\ub514 \/ \ud3ed\uc2a4\ubc14\uac90 \uc13c\ud130 \uacbd\ub825 10\ub144","reservation_url":"https:\/\/www.carvazo.com\/\uc774\ud6a8\uc900\uc815\ube44\uc0ac"},{"profile":"https:\/\/app.carvazo.com\/files\/store\/2017\/0803\/def716c6d3324fedecc24d35f14605f3_FThumb.jpg","name":"\uc131\uc885\ud638","area":"\uacbd\uae30 \uc548\uc0b0\uc9c0\uc5ed, \uc11c\uc6b8 \uac15\ub0a8\uc9c0\uc5ed \ub4f1","rating":"5.0","description":"\uc790\ub3d9\ucc28 \uc815\ube44 \uacbd\ub825 20\ub144","reservation_url":"https:\/\/www.carvazo.com\/\uc131\uc885\ud638\uc815\ube44\uc0ac"}],"status":true,"count":3}'

  var card_list = []

  var data_ar = JSON.parse(data_json, 'utf8')
  if (data_ar.data.length) {
    var mechanic_list = data_ar.data

    mechanic_list.forEach(function (item) {
      card_list.push(new builder.HeroCard(session)
            .title(item.name + '(평점 ' + item.rating + ')')
            .subtitle(item.area)
            .text(item.description)
            .images([builder.CardImage.create(session, item.profile)])
            .buttons([ builder.CardAction.openUrl(session, item.reservation_url, '예약하기')]))
    })
  }

  return card_list

    // return [

    //      new builder.HeroCard(session)
    //         .title('1. 차량 조회')
    //         .subtitle('자신의 차량 번호 입력')
    //         .text('차량을 조회하고 상담받아 보세요')
    //         .images([builder.CardImage.create(session,'https://www.carvazo.com/files/event/2017/0708/8d1b575fb341204ec20be8db31295849_FThumb.jpg')])
    //         .buttons([ builder.CardAction.imBack(session,"1","차량조회")])
    // ];
}

function getCardAttachments (session) {
  return [
    new builder.HeroCard(session)
            .title('1. 차량 조회')
            .subtitle('자신의 차량 번호 입력')
            .text('차량을 조회하고 상담받아 보세요')
            .images([builder.CardImage.create(session, 'https://www.carvazo.com/img/slide_06.png')])
            .buttons([ builder.CardAction.imBack(session, '1', '1.차량조회')]),
    new builder.HeroCard(session)
            .title('2. 예약 문의')
            .subtitle('예약 관련 문의사항')
            .text('원하는 날짜에 예약을 도와드립니다')
            .images([builder.CardImage.create(session, 'https://www.carvazo.com/files/event/2017/0708/8d1b575fb341204ec20be8db31295849_FThumb.jpg')])
            .buttons([ builder.CardAction.imBack(session, '2', '2.예약 문의')]),
    new builder.HeroCard(session)
            .title('3. FAQ')
            .subtitle('자주 묻는 질문')
            .text('자주 묻는 질문에 답해드립니다')
            .images([builder.CardImage.create(session, 'https://www.carvazo.com/img/KakaoTalk_Photo_2017-07-18-16-36-37_55.png')])
            .buttons([ builder.CardAction.imBack(session, '3', '3.자주 묻는 질문')])
  ]
}

function caldate (day) {
  var caledmonth, caledday, caledYear
  var loadDt = new Date()
  var v = new Date(Date.parse(loadDt) + day * 1000 * 60 * 60 * 24)

  caledYear = v.getFullYear()

  if (v.getMonth() < 9) {
    caledmonth = '0' + (v.getMonth() + 1)
  } else {
    caledmonth = v.getMonth() + 1
  }
  if (v.getDate() < 9) {
    caledday = '0' + v.getDate()
  } else {
    caledday = v.getDate()
  }

  var week = new Array('일', '월', '화', '수', '목', '금', '토')
  var today = new Date(caledYear + '-' + caledmonth + '-' + caledday).getDay()
  var todayLabel = week[today]

  return caledmonth + '/' + caledday + '(' + todayLabel + ')'
}

function sendEalryAccess (params) {
    // Set the headers
  var headers = {
    'User-Agent': 'ms bot/0.0.1',
    'Content-Type': 'application/x-www-form-urlencoded'
  }

    // Configure the request
  var options = {
    url: process.env.CarvazoTargetEalry, // CarvazoTargetEalry
    method: 'POST',
    headers: headers,
    form: params
  }

    // Start the request
  request(options, function (error, response, body) {
    console.log(response.statusCode)
    if (!error && response.statusCode == 200) {
            // Print out the response body
      console.log(body)
    }
  })
}

function car_num_chk (car_num) {
  var v = car_num

  var pattern1 = /\d{2}[가-힣ㄱ-ㅎㅏ-ㅣ\x20]\d{4}/g // 12저1234
  var pattern2 = /[가-힣ㄱ-ㅎㅏ-ㅣ\x20]{2}\d{2}[가-힣ㄱ-ㅎㅏ-ㅣ\x20]\d{4}/g // 서울12치1233

  if (!pattern1.test(v)) {
    if (!pattern2.test(v)) {
      return false
    } else {
      return true
    }
  } else {
    return true
  }
}

function validate_phone (phone_num) {
  var regExp = /^(01[016789]{1}|02|0[3-9]{1}[0-9]{1})-?[0-9]{3,4}-?[0-9]{4}$/
  var tel = phone_num

  if (!regExp.test(tel)) {
    return false
  } else {
    return true
  }
}
