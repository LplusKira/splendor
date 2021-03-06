import B from 'app/broker';
import db from 'app/db';
import _ from 'underscore';

const debug = require('debug')('app/actions/game');

import {initActors} from 'app/AI/actors';

import setting from 'app/data/game-setting';
import {colors} from 'app/data/game-setting';
import cards from 'app/data/cards';
import nobleData from 'app/data/nobles';

const nobles = nobleData.map((noble, i) => {
  noble.key = i;
  return noble;
});

// card statuses:
//   - deck
//   - board
//   - hold
//   - bought
const groupedCards = _(cards.map((card, i) => {
  card.key = i;
  card.status = 'deck';
  return card;
})).groupBy(card => card.rank);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function changeCardStatus(status) {
  return (ocard) => {
    let card = clone(ocard);
    card.status = status;
    return card;
  };
}

B.on('game/init', (action) => {
  const { players: playerActors, winGameScore, mode, rounds, fast } = action;

  const playerCount = playerActors.length;

  db.set('game-settings', {
    'player-actors': playerActors,
    'win-game-score': winGameScore,
    'tourment-rounds': rounds,
    'fast-mode': fast,
  });

  if(mode == 'tourment') {
    if(!db.get(['tourment', 'currentRound'])) {
      db.set('tourment', {
        rounds,
        currentRound: 0,
        wins: playerActors.map(player => {
          return 0;
        }),
        turns: [],
      });
    }
    const currentRound = db.get(['tourment', 'currentRound']);
    db.set(['tourment', 'currentRound'], currentRound + 1);
  }

  const {
    1: rank1cards,
    2: rank2cards,
    3: rank3cards,
  } = groupedCards;

  const rank1deck = _.shuffle(rank1cards);
  const rank2deck = _.shuffle(rank2cards);
  const rank3deck = _.shuffle(rank3cards);

  const resources =  Object.assign({
    gold: 5,
  }, colors.reduce((res, color) => {
    res[color] = setting[playerCount].resource;
    return res;
  }, {}));

  const players = playerActors.map((actor, i) => {
    return {
      key: i,
      actor: actor,
      bonus: {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0,
      },
      resources: {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0,
        gold: 0,
      },
      score: 0,
      reservedCards: [],
    };
  });

  db.set('game', {
    mode: mode,
    turn: 1,
    'current-player': 0,
    'win-game-score': winGameScore,
    cards1: _(rank1deck).take(4).map(changeCardStatus('board')),
    cards2: _(rank2deck).take(4).map(changeCardStatus('board')),
    cards3: _(rank3deck).take(4).map(changeCardStatus('board')),
    deck1: _(rank1deck).drop(4),
    deck2: _(rank2deck).drop(4),
    deck3: _(rank3deck).drop(4),
    nobles: _(nobles).chain().shuffle().take(setting[playerCount].nobles).value(),
    resources,
    players,
  });

  db.set(['actor-stores'], [{}, {}, {}, {}]);
  initActors(playerActors);

  requestAnimationFrame(() => {
    B.do({ action: 'gameevent/turn' });
  });
});

B.on('game/exit', (action) => {
  db.unset(['game']);
  db.unset(['tourment']);
});

