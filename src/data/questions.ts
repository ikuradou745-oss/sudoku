import { Question, Modifier } from '../types';

export const QUESTION_BANK: Question[] = [
  // ==========================================
  // --- 英検5級 基礎 (Eiken Grade 5) (20問) ---
  // ==========================================
  {
    id: 'e5_01',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '私は毎朝7時に起きます。',
    promptSentence: 'I ____ up at seven every morning.',
    choices: ['wake', 'wakes', 'waking', 'woke'],
    correctAnswer: 'wake',
    english: 'I wake up at seven every morning.',
    explanation: '主語が「I」なので、現在形の動詞の原形 wake を使います。',
    audioPrompt: 'I wake up at seven every morning.'
  },
  {
    id: 'e5_02',
    type: 'order',
    difficulty: '5kyu',
    japanese: '私の父は先生です。',
    wordOptions: ['My', 'father', 'is', 'a', 'teacher.'],
    correctAnswer: 'My father is a teacher.',
    english: 'My father is a teacher.',
    explanation: '主語「My father」＋ be動詞「is」＋ 補語「a teacher」の語順です。',
    audioPrompt: 'My father is a teacher.'
  },
  {
    id: 'e5_03',
    type: 'translate',
    difficulty: '5kyu',
    japanese: '「りんご」を英語で何と言いますか？',
    choices: ['apple', 'orange', 'banana', 'grape'],
    correctAnswer: 'apple',
    english: 'apple',
    explanation: 'apple = りんご（うおリンゴのリンゴでもあります！）',
    audioPrompt: 'apple'
  },
  {
    id: 'e5_04',
    type: 'blank',
    difficulty: '5kyu',
    japanese: 'あなたはピアノを弾くことができますか？',
    promptSentence: '____ you play the piano?',
    choices: ['Can', 'Are', 'Is', 'Do'],
    correctAnswer: 'Can',
    english: 'Can you play the piano?',
    explanation: '「〜できますか」という能力・可能を尋ねるときは助動詞「Can」を使います。',
    audioPrompt: 'Can you play the piano?'
  },
  {
    id: 'e5_05',
    type: 'order',
    difficulty: '5kyu',
    japanese: '彼女は犬が好きです。',
    wordOptions: ['She', 'likes', 'dogs.'],
    correctAnswer: 'She likes dogs.',
    english: 'She likes dogs.',
    explanation: '主語が三人称単数（She）なので、like に「s」がついて likes になります。',
    audioPrompt: 'She likes dogs.'
  },
  {
    id: 'e5_06',
    type: 'dialogue',
    difficulty: '5kyu',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "Good morning, Ken!"\nB: "____"',
    promptSentence: 'A: "Good morning, Ken!"\nB: "____"',
    choices: ['Good morning!', 'Good night!', 'You are welcome.', 'I am fine.'],
    correctAnswer: 'Good morning!',
    english: 'Good morning!',
    explanation: '「Good morning!」と挨拶されたら、同じく「Good morning!」と返します。',
    audioPrompt: 'Good morning!'
  },
  {
    id: 'e5_07',
    type: 'listening',
    difficulty: '5kyu',
    japanese: '音声を聴いて、正しい英文を選んでください。',
    choices: ['This is a pen.', 'This is a book.', 'That is a pencil.', 'It is a bag.'],
    correctAnswer: 'This is a book.',
    english: 'This is a book.',
    explanation: '音声「This is a book.」（これは本です）を聞き取ります。',
    audioPrompt: 'This is a book.'
  },
  {
    id: 'e5_08',
    type: 'blank',
    difficulty: '5kyu',
    japanese: 'ケンと私は公園にいます。',
    promptSentence: 'Ken and I ____ in the park.',
    choices: ['are', 'am', 'is', 'be'],
    correctAnswer: 'are',
    english: 'Ken and I are in the park.',
    explanation: '主語が「Ken and I」（二人＝複数）なので be動詞は are になります。',
    audioPrompt: 'Ken and I are in the park.'
  },
  {
    id: 'e5_09',
    type: 'order',
    difficulty: '5kyu',
    japanese: '私たちは放課後サッカーをします。',
    wordOptions: ['We', 'play', 'soccer', 'after', 'school.'],
    correctAnswer: 'We play soccer after school.',
    english: 'We play soccer after school.',
    explanation: '「after school」は「放課後に」という熟語です。',
    audioPrompt: 'We play soccer after school.'
  },
  {
    id: 'e5_10',
    type: 'translate',
    difficulty: '5kyu',
    japanese: '「図書館」を意味する英単語はどれですか？',
    choices: ['library', 'hospital', 'station', 'supermarket'],
    correctAnswer: 'library',
    english: 'library',
    explanation: 'library = 図書館、hospital = 病院、station = 駅 です。',
    audioPrompt: 'library'
  },
  {
    id: 'e5_11',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '今何時ですか？',
    promptSentence: 'What ____ is it now?',
    choices: ['time', 'color', 'day', 'hour'],
    correctAnswer: 'time',
    english: 'What time is it now?',
    explanation: '「今何時ですか？」は定型表現「What time is it now?」です。',
    audioPrompt: 'What time is it now?'
  },
  {
    id: 'e5_12',
    type: 'order',
    difficulty: '5kyu',
    japanese: 'この箱を開けてください。',
    wordOptions: ['Please', 'open', 'this', 'box.'],
    correctAnswer: 'Please open this box.',
    english: 'Please open this box.',
    explanation: '「Please + 動詞の原形」で「〜してください」という丁寧な命令文になります。',
    audioPrompt: 'Please open this box.'
  },
  {
    id: 'e5_13',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '私の誕生日は5月です。',
    promptSentence: 'My birthday is ____ May.',
    choices: ['in', 'on', 'at', 'to'],
    correctAnswer: 'in',
    english: 'My birthday is in May.',
    explanation: '月（May, Juneなど）の前には前置詞「in」を使います。（特定の日付にはon）。',
    audioPrompt: 'My birthday is in May.'
  },
  {
    id: 'e5_14',
    type: 'order',
    difficulty: '5kyu',
    japanese: '彼らは日曜日には学校へ行きません。',
    wordOptions: ['They', 'do', 'not', 'go', 'to', 'school', 'on', 'Sundays.'],
    correctAnswer: 'They do not go to school on Sundays.',
    english: 'They do not go to school on Sundays.',
    explanation: '一般動詞の否定文「do not go」＋「on Sundays（毎週日曜日に）」です。',
    audioPrompt: 'They do not go to school on Sundays.'
  },
  {
    id: 'e5_15',
    type: 'dialogue',
    difficulty: '5kyu',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "How are you today?"\nB: "____"',
    promptSentence: 'A: "How are you today?"\nB: "____"',
    choices: ['I am fine, thank you.', 'I am ten years old.', 'Yes, I am.', 'See you later.'],
    correctAnswer: 'I am fine, thank you.',
    english: 'I am fine, thank you.',
    explanation: '「How are you?（ご機嫌いかがですか？）」には「I am fine, thank you.」と答えます。',
    audioPrompt: 'I am fine, thank you.'
  },
  {
    id: 'e5_16',
    type: 'translate',
    difficulty: '5kyu',
    japanese: '「朝食を食べる」という意味のフレーズはどれですか？',
    choices: ['have breakfast', 'take a bath', 'go to bed', 'wash hands'],
    correctAnswer: 'have breakfast',
    english: 'have breakfast',
    explanation: 'have breakfast（または eat breakfast）で「朝食を食べる」という意味です。',
    audioPrompt: 'have breakfast'
  },
  {
    id: 'e5_17',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '机の上に一冊のノートがあります。',
    promptSentence: 'There is a notebook ____ the desk.',
    choices: ['on', 'in', 'at', 'under'],
    correctAnswer: 'on',
    english: 'There is a notebook on the desk.',
    explanation: '机の表面の上を表すときは前置詞「on」を使います。',
    audioPrompt: 'There is a notebook on the desk.'
  },
  {
    id: 'e5_18',
    type: 'listening',
    difficulty: '5kyu',
    japanese: '音声を聴いて、当てはまる英文を選んでください。',
    choices: ['Open your book to page ten.', 'Close your eyes.', 'Stand up, please.', 'Sit down here.'],
    correctAnswer: 'Open your book to page ten.',
    english: 'Open your book to page ten.',
    explanation: '音声「Open your book to page ten.」（本の10ページを開いてください）を聞き取ります。',
    audioPrompt: 'Open your book to page ten.'
  },
  {
    id: 'e5_19',
    type: 'order',
    difficulty: '5kyu',
    japanese: 'あなたは猫を一匹飼っていますか？',
    wordOptions: ['Do', 'you', 'have', 'a', 'cat?'],
    correctAnswer: 'Do you have a cat?',
    english: 'Do you have a cat?',
    explanation: '一般動詞 have の疑問文は「Do you have 〜?」で作ります。',
    audioPrompt: 'Do you have a cat?'
  },
  {
    id: 'e5_20',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '彼はとても上手に英語を話します。',
    promptSentence: 'He speaks English very ____.',
    choices: ['well', 'good', 'fine', 'nice'],
    correctAnswer: 'well',
    english: 'He speaks English very well.',
    explanation: '動詞 speaks を修飾する副詞は「well（上手に）」です。',
    audioPrompt: 'He speaks English very well.'
  },

  // ==========================================
  // --- 英検4級 レベル (Eiken Grade 4) (20問) ---
  // ==========================================
  {
    id: 'e4_01',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '私は昨日、新しい靴を買いました。',
    promptSentence: 'I ____ new shoes yesterday.',
    choices: ['bought', 'buy', 'buys', 'buying'],
    correctAnswer: 'bought',
    english: 'I bought new shoes yesterday.',
    explanation: '「yesterday（昨日）」があるため、過去形の bought（buyの過去形）を選びます。',
    audioPrompt: 'I bought new shoes yesterday.'
  },
  {
    id: 'e4_02',
    type: 'order',
    difficulty: '4kyu',
    japanese: '彼は先週の日曜日、祖父母を訪ねました。',
    wordOptions: ['He', 'visited', 'his', 'grandparents', 'last', 'Sunday.'],
    correctAnswer: 'He visited his grandparents last Sunday.',
    english: 'He visited his grandparents last Sunday.',
    explanation: '「visited」（過去形）＋「last Sunday」（先週の日曜日）の文構造です。',
    audioPrompt: 'He visited his grandparents last Sunday.'
  },
  {
    id: 'e4_03',
    type: 'blank',
    difficulty: '4kyu',
    japanese: 'なぜ遅刻したのですか？',
    promptSentence: '____ were you late for school?',
    choices: ['Why', 'What', 'Where', 'Who'],
    correctAnswer: 'Why',
    english: 'Why were you late for school?',
    explanation: '理由を尋ねる疑問詞は「Why（なぜ）」です。「be late for 〜」で「〜に遅刻する」。',
    audioPrompt: 'Why were you late for school?'
  },
  {
    id: 'e4_04',
    type: 'dialogue',
    difficulty: '4kyu',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "Where is the station?"\nB: "____"',
    promptSentence: 'A: "Where is the station?"\nB: "____"',
    choices: ['Go straight down this street.', 'Yes, I do.', 'It is five dollars.', 'I like trains.'],
    correctAnswer: 'Go straight down this street.',
    english: 'Go straight down this street.',
    explanation: '「駅はどこですか？」と道を尋ねられているので、「この道をまっすぐ行ってください」と答えます。',
    audioPrompt: 'Go straight down this street.'
  },
  {
    id: 'e4_05',
    type: 'order',
    difficulty: '4kyu',
    japanese: '私は将来、医者になりたいです。',
    wordOptions: ['I', 'want', 'to', 'be', 'a', 'doctor.'],
    correctAnswer: 'I want to be a doctor.',
    english: 'I want to be a doctor.',
    explanation: '「want to be 〜」で「〜になりたい」という不定詞の名詞的用法です。',
    audioPrompt: 'I want to be a doctor.'
  },
  {
    id: 'e4_06',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '空にはたくさんの星があります。',
    promptSentence: 'There ____ many stars in the sky.',
    choices: ['are', 'is', 'was', 'have'],
    correctAnswer: 'are',
    english: 'There are many stars in the sky.',
    explanation: '「There is/are 〜」の構文で、後ろの名詞が「many stars」（複数）なので are です。',
    audioPrompt: 'There are many stars in the sky.'
  },
  {
    id: 'e4_07',
    type: 'listening',
    difficulty: '4kyu',
    japanese: '音声を聴いて、該当する英文を選んでください。',
    choices: [
      'She is studying math in her room.',
      'She is playing tennis with her friends.',
      'She went to the library by bus.',
      'She will cook dinner tonight.'
    ],
    correctAnswer: 'She is studying math in her room.',
    english: 'She is studying math in her room.',
    explanation: '音声「She is studying math in her room.」（彼女は部屋で数学を勉強しています）を聞き取ります。',
    audioPrompt: 'She is studying math in her room.'
  },
  {
    id: 'e4_08',
    type: 'translate',
    difficulty: '4kyu',
    japanese: '「〜を楽しみに待つ」という意味の連語はどれですか？',
    choices: ['look forward to', 'take care of', 'give up', 'look for'],
    correctAnswer: 'look forward to',
    english: 'look forward to',
    explanation: 'look forward to = 〜を楽しみに待つ、take care of = 〜の世話をする、look for = 〜を探す。',
    audioPrompt: 'look forward to'
  },
  {
    id: 'e4_09',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '彼は昨夜、テレビを見ませんでした。',
    promptSentence: 'He ____ watch TV last night.',
    choices: ["didn't", "doesn't", "don't", "wasn't"],
    correctAnswer: "didn't",
    english: "He didn't watch TV last night.",
    explanation: '一般動詞（watch）の過去の否定文には助動詞 didn\'t を使い、後ろは動詞の原形にします。',
    audioPrompt: "He didn't watch TV last night."
  },
  {
    id: 'e4_10',
    type: 'order',
    difficulty: '4kyu',
    japanese: '明日雨が降ったら、家にいます。',
    wordOptions: ['If', 'it', 'rains', 'tomorrow,', 'I', 'will', 'stay', 'home.'],
    correctAnswer: 'If it rains tomorrow, I will stay home.',
    english: 'If it rains tomorrow, I will stay home.',
    explanation: '接続詞「If（もし〜なら）」の節では、未来のことであっても現在形（rains）を使います。',
    audioPrompt: 'If it rains tomorrow, I will stay home.'
  },
  {
    id: 'e4_11',
    type: 'dialogue',
    difficulty: '4kyu',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "May I use your pen?"\nB: "____"',
    promptSentence: 'A: "May I use your pen?"\nB: "____"',
    choices: ['Sure, here you are.', 'No, thank you.', 'I am sorry to hear that.', 'Nice to meet you.'],
    correctAnswer: 'Sure, here you are.',
    english: 'Sure, here you are.',
    explanation: '「ペンをお借りしてもいいですか？」への許可として「もちろん、どうぞ（Sure, here you are.）」と答えます。',
    audioPrompt: 'Sure, here you are.'
  },
  {
    id: 'e4_12',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '私の兄は私より背が高いです。',
    promptSentence: 'My brother is ____ than me.',
    choices: ['taller', 'tall', 'tallest', 'more tall'],
    correctAnswer: 'taller',
    english: 'My brother is taller than me.',
    explanation: '「〜より背が高い」という比較級は「taller than」になります。',
    audioPrompt: 'My brother is taller than me.'
  },
  {
    id: 'e4_13',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '富士山は日本で最も高い山です。',
    promptSentence: 'Mt. Fuji is the ____ mountain in Japan.',
    choices: ['highest', 'higher', 'high', 'most high'],
    correctAnswer: 'highest',
    english: 'Mt. Fuji is the highest mountain in Japan.',
    explanation: '最上級「the + highest（最も高い）」を使います。',
    audioPrompt: 'Mt. Fuji is the highest mountain in Japan.'
  },
  {
    id: 'e4_14',
    type: 'order',
    difficulty: '4kyu',
    japanese: 'あなたは明日何をする予定ですか？',
    wordOptions: ['What', 'are', 'you', 'going', 'to', 'do', 'tomorrow?'],
    correctAnswer: 'What are you going to do tomorrow?',
    english: 'What are you going to do tomorrow?',
    explanation: 'be going to による未来の疑問文「What are you going to do 〜?」です。',
    audioPrompt: 'What are you going to do tomorrow?'
  },
  {
    id: 'e4_15',
    type: 'translate',
    difficulty: '4kyu',
    japanese: '「〜が得意である」を意味する熟語はどれですか？',
    choices: ['be good at', 'be fond of', 'be interested in', 'be late for'],
    correctAnswer: 'be good at',
    english: 'be good at',
    explanation: 'be good at 〜 = 〜が得意である、be interested in 〜 = 〜に興味がある。',
    audioPrompt: 'be good at'
  },
  {
    id: 'e4_16',
    type: 'blank',
    difficulty: '4kyu',
    japanese: '本を読むことはとても面白いです。',
    promptSentence: '____ books is very interesting.',
    choices: ['Reading', 'Read', 'Reads', 'To reading'],
    correctAnswer: 'Reading',
    english: 'Reading books is very interesting.',
    explanation: '「本を読むこと」という動名詞「Reading」が主語になっています。',
    audioPrompt: 'Reading books is very interesting.'
  },
  {
    id: 'e4_17',
    type: 'dialogue',
    difficulty: '4kyu',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "Shall we go for a walk?"\nB: "____"',
    promptSentence: 'A: "Shall we go for a walk?"\nB: "____"',
    choices: ['Yes, let\'s!', 'No, I don\'t.', 'You are right.', 'Never mind.'],
    correctAnswer: 'Yes, let\'s!',
    english: "Yes, let's!",
    explanation: '「Shall we 〜?（一緒に〜しませんか？）」への返答として「Yes, let\'s!（ええ、そうしましょう！）」と答えます。',
    audioPrompt: "Yes, let's!"
  },
  {
    id: 'e4_18',
    type: 'order',
    difficulty: '4kyu',
    japanese: '彼女は私に素敵な手紙を書いてくれました。',
    wordOptions: ['She', 'wrote', 'a', 'nice', 'letter', 'to', 'me.'],
    correctAnswer: 'She wrote a nice letter to me.',
    english: 'She wrote a nice letter to me.',
    explanation: '「wrote（書いた）」＋目的語「a nice letter」＋「to me」の構成です。',
    audioPrompt: 'She wrote a nice letter to me.'
  },
  {
    id: 'e4_19',
    type: 'listening',
    difficulty: '4kyu',
    japanese: '音声を聴いて、該当する英文を選んでください。',
    choices: [
      'You must finish your homework before dinner.',
      'You can play games all day.',
      'You should go to bed early tonight.',
      'You may leave the classroom now.'
    ],
    correctAnswer: 'You must finish your homework before dinner.',
    english: 'You must finish your homework before dinner.',
    explanation: '音声「You must finish your homework before dinner.」（夕食前に宿題を終えなければなりません）を聞き取ります。',
    audioPrompt: 'You must finish your homework before dinner.'
  },
  {
    id: 'e4_20',
    type: 'blank',
    difficulty: '4kyu',
    japanese: 'この川はあの川と同じくらい長いです。',
    promptSentence: 'This river is as ____ as that one.',
    choices: ['long', 'longer', 'longest', 'length'],
    correctAnswer: 'long',
    english: 'This river is as long as that one.',
    explanation: '同等比較「as + 原級 + as」なので、形容詞の原形 long を入れます。',
    audioPrompt: 'This river is as long as that one.'
  },

  // ==========================================
  // --- 文を伸ばす (Longer Sentences) (8問) ---
  // ==========================================
  {
    id: 'long_01',
    type: 'order',
    difficulty: 'long',
    japanese: '私の姉は忙しかったので、夕食を作ることができませんでした。',
    wordOptions: ['Because', 'my', 'sister', 'was', 'busy,', 'she', 'could', 'not', 'cook', 'dinner.'],
    correctAnswer: 'Because my sister was busy, she could not cook dinner.',
    english: 'Because my sister was busy, she could not cook dinner.',
    explanation: '「Because」で理由の節を作り、主節で「could not cook」と繋ぎます。',
    audioPrompt: 'Because my sister was busy, she could not cook dinner.'
  },
  {
    id: 'long_02',
    type: 'blank',
    difficulty: 'long',
    japanese: '私が家に帰ったとき、母は台所で夕食を作っていました。',
    promptSentence: 'When I came home, my mother was ____ dinner in the kitchen.',
    choices: ['cooking', 'cooked', 'cooks', 'cook'],
    correctAnswer: 'cooking',
    english: 'When I came arrived home, my mother was cooking dinner in the kitchen.',
    explanation: '過去進行形「was + cooking（〜していた）」の形です。',
    audioPrompt: 'When I came home, my mother was cooking dinner in the kitchen.'
  },
  {
    id: 'long_03',
    type: 'order',
    difficulty: 'long',
    japanese: '世界中の人々と話すために英語を勉強することはとても大切です。',
    wordOptions: ['Studying', 'English', 'is', 'very', 'important', 'to', 'talk', 'with', 'people', 'all', 'over', 'the', 'world.'],
    correctAnswer: 'Studying English is very important to talk with people all over the world.',
    english: 'Studying English is very important to talk with people all over the world.',
    explanation: '動名詞「Studying English」が主語で、「to talk with...」が目的を表す不定詞です。',
    audioPrompt: 'Studying English is very important to talk with people all over the world.'
  },
  {
    id: 'long_04',
    type: 'blank',
    difficulty: 'long',
    japanese: 'あなたと私は先週末に動物園でたくさんの動物を見ました。',
    promptSentence: 'You and I ____ many interesting animals at the zoo last weekend.',
    choices: ['saw', 'see', 'seeing', 'sees'],
    correctAnswer: 'saw',
    english: 'You and I saw many interesting animals at the zoo last weekend.',
    explanation: '「last weekend（先週末）」があるため過去形の saw（seeの過去形）を選びます。',
    audioPrompt: 'You and I saw many interesting animals at the zoo last weekend.'
  },
  {
    id: 'long_05',
    type: 'dialogue',
    difficulty: 'long',
    japanese: '会話の空欄に入る適切な言葉を選びましょう。\nA: "What are you going to do during the summer vacation?"\nB: "____"',
    promptSentence: 'A: "What are you going to do during the summer vacation?"\nB: "____"',
    choices: [
      'I am planning to visit my grandparents in Hokkaido.',
      'I was very tired yesterday afternoon.',
      'Yes, it is very hot outside today.',
      'I bought a new bicycle last week.'
    ],
    correctAnswer: 'I am planning to visit my grandparents in Hokkaido.',
    english: 'I am planning to visit my grandparents in Hokkaido.',
    explanation: '「夏休みは何をする予定ですか？」という未来の予定の質問に対して、予定を答えます。',
    audioPrompt: 'I am planning to visit my grandparents in Hokkaido.'
  },
  {
    id: 'long_06',
    type: 'order',
    difficulty: 'long',
    japanese: 'もし明日晴れたら、私たちは友達と一緒に海へ泳ぎに行きます。',
    wordOptions: ['If', 'it', 'is', 'sunny', 'tomorrow,', 'we', 'will', 'go', 'swimming', 'at', 'the', 'beach.'],
    correctAnswer: 'If it is sunny tomorrow, we will go swimming at the beach.',
    english: 'If it is sunny tomorrow, we will go swimming at the beach.',
    explanation: '「If + 現在形, will + 動詞の原形」で未来の条件文を表します。',
    audioPrompt: 'If it is sunny tomorrow, we will go swimming at the beach.'
  },
  {
    id: 'long_07',
    type: 'blank',
    difficulty: 'long',
    japanese: '私の父は毎日仕事に行く前に、必ず朝のニュースをチェックします。',
    promptSentence: 'My father always checks the morning news before he ____ to work.',
    choices: ['goes', 'went', 'going', 'go'],
    correctAnswer: 'goes',
    english: 'My father always checks the morning news before he goes to work.',
    explanation: '時を表す副詞節（before 〜）の中では三人称単数の現在形 goes を使います。',
    audioPrompt: 'My father always checks the morning news before he goes to work.'
  },
  {
    id: 'long_08',
    type: 'order',
    difficulty: 'long',
    japanese: '彼女は昨晩遅くまで試験のために熱心に勉強していました。',
    wordOptions: ['She', 'was', 'studying', 'hard', 'for', 'the', 'exam', 'until', 'late', 'last', 'night.'],
    correctAnswer: 'She was studying hard for the exam until late last night.',
    english: 'She was studying hard for the exam until late last night.',
    explanation: '過去進行形「was studying」＋「until late last night（昨夜遅くまで）」の語順です。',
    audioPrompt: 'She was studying hard for the exam until late last night.'
  },

  // ==========================================
  // --- チャレンジ問題 (難問・英検3級〜) (12問) ---
  // ==========================================
  {
    id: 'ch_01',
    type: 'blank',
    difficulty: 'challenge',
    japanese: '【チャレンジ】私はこれまでに3回京都を訪れたことがあります。',
    promptSentence: 'I have ____ Kyoto three times.',
    choices: ['visited', 'visit', 'visiting', 'been to visit'],
    correctAnswer: 'visited',
    english: 'I have visited Kyoto three times.',
    explanation: '現在完了形「have + 過去分詞（経験用法: 〜したことがある）」です。',
    audioPrompt: 'I have visited Kyoto three times.'
  },
  {
    id: 'ch_02',
    type: 'order',
    difficulty: 'challenge',
    japanese: '【チャレンジ】あそこでギターを弾いている少年は私の弟です。',
    wordOptions: ['The', 'boy', 'playing', 'the', 'guitar', 'over', 'there', 'is', 'my', 'brother.'],
    correctAnswer: 'The boy playing the guitar over there is my brother.',
    english: 'The boy playing the guitar over there is my brother.',
    explanation: '現在分詞の後置修飾「The boy playing the guitar over there」が文全体の主語になります。',
    audioPrompt: 'The boy playing the guitar over there is my brother.'
  },
  {
    id: 'ch_03',
    type: 'blank',
    difficulty: 'challenge',
    japanese: '【チャレンジ】この寺は約300年前に建てられました。',
    promptSentence: 'This temple was ____ about three hundred years ago.',
    choices: ['built', 'build', 'building', 'builds'],
    correctAnswer: 'built',
    english: 'This temple was built about three hundred years ago.',
    explanation: '受動態「was + 過去分詞（〜された）」の形です。build の過去分詞は built です。',
    audioPrompt: 'This temple was built about three hundred years ago.'
  },
  {
    id: 'ch_04',
    type: 'order',
    difficulty: 'challenge',
    japanese: '【チャレンジ】駅への行き方を教えていただけますか？',
    wordOptions: ['Could', 'you', 'please', 'tell', 'me', 'how', 'to', 'get', 'to', 'the', 'station?'],
    correctAnswer: 'Could you please tell me how to get to the station?',
    english: 'Could you please tell me how to get to the station?',
    explanation: '「how to get to 〜」で「〜への行き方」を表す丁寧な依頼表現です。',
    audioPrompt: 'Could you please tell me how to get to the station?'
  },
  {
    id: 'ch_05',
    type: 'blank',
    difficulty: 'challenge',
    japanese: '【チャレンジ】私は向こうに立っている少女を知りません。',
    promptSentence: 'I do not know the girl ____ is standing over there.',
    choices: ['who', 'which', 'what', 'whom'],
    correctAnswer: 'who',
    english: 'I do not know the girl who is standing over there.',
    explanation: '先行詞が「the girl（人）」なので、関係代名詞の主格「who」を用います。',
    audioPrompt: 'I do not know the girl who is standing over there.'
  },
  {
    id: 'ch_06',
    type: 'translate',
    difficulty: 'challenge',
    japanese: '【チャレンジ】「できるだけ早く」という意味の重要熟語はどれですか？',
    choices: ['as soon as possible', 'so far so good', 'by the way', 'all of a sudden'],
    correctAnswer: 'as soon as possible',
    english: 'as soon as possible',
    explanation: 'as soon as possible (ASAP) = できるだけ早く、all of a sudden = 突然、by the way = ところで。',
    audioPrompt: 'as soon as possible'
  },
  {
    id: 'ch_07',
    type: 'order',
    difficulty: 'challenge',
    japanese: '【チャレンジ】彼はその映画を見るには幼すぎます。',
    wordOptions: ['He', 'is', 'too', 'young', 'to', 'watch', 'that', 'movie.'],
    correctAnswer: 'He is too young to watch that movie.',
    english: 'He is too young to watch that movie.',
    explanation: '「too ... to 〜」構文で「あまりに…なので〜できない（〜するには…すぎる）」を表します。',
    audioPrompt: 'He is too young to watch that movie.'
  },
  {
    id: 'ch_08',
    type: 'dialogue',
    difficulty: 'challenge',
    japanese: '【チャレンジ】会話の空欄に入る適切な言葉を選びましょう。\nA: "Would you mind opening the window?"\nB: "____"',
    promptSentence: 'A: "Would you mind opening the window?"\nB: "____"',
    choices: ['Not at all. Go ahead.', 'Yes, please open it.', 'I am sorry, you can.', 'No, you do not mind.'],
    correctAnswer: 'Not at all. Go ahead.',
    english: 'Not at all. Go ahead.',
    explanation: '「Would you mind -ing?（〜していただけませんか？）」は「気にするか」を問うため、「いいですよ（気にしません）」は「Not at all.（全く構いません）」と答えます。',
    audioPrompt: 'Not at all. Go ahead.'
  },
  {
    id: 'ch_09',
    type: 'listening',
    difficulty: 'challenge',
    japanese: '【チャレンジ】音声を聴いて、最も適切な英文を選んでください。',
    choices: [
      'The book which I bought yesterday is very exciting.',
      'The book who was written last year is popular.',
      'I have never read such an interesting magazine.',
      'She told me that the library would open tomorrow.'
    ],
    correctAnswer: 'The book which I bought yesterday is very exciting.',
    english: 'The book which I bought yesterday is very exciting.',
    explanation: '音声「The book which I bought yesterday is very exciting.」（私が昨日買った本はとてもワクワクします）を聞き取ります。',
    audioPrompt: 'The book which I bought yesterday is very exciting.'
  },
  {
    id: 'ch_10',
    type: 'blank',
    difficulty: 'challenge',
    japanese: '【チャレンジ】私たちはそのコンテストに参加することに決めました。',
    promptSentence: 'We decided to ____ part in the speech contest.',
    choices: ['take', 'make', 'have', 'give'],
    correctAnswer: 'take',
    english: 'We decided to take part in the speech contest.',
    explanation: '「take part in 〜」で「〜に参加する（= participate in）」という重要イディオムです。',
    audioPrompt: 'We decided to take part in the speech contest.'
  },
  {
    id: 'ch_11',
    type: 'order',
    difficulty: 'challenge',
    japanese: '【チャレンジ】彼がどこに住んでいるか知っていますか？',
    wordOptions: ['Do', 'you', 'know', 'where', 'he', 'lives?'],
    correctAnswer: 'Do you know where he lives?',
    english: 'Do you know where he lives?',
    explanation: '間接疑問文「疑問詞（where）＋主語（he）＋動詞（lives）」の肯定文語順になります。',
    audioPrompt: 'Do you know where he lives?'
  },
  {
    id: 'ch_12',
    type: 'blank',
    difficulty: 'challenge',
    japanese: '【チャレンジ】彼は10年間ずっと日本に住んでいます。',
    promptSentence: 'He has ____ in Japan for ten years.',
    choices: ['lived', 'lives', 'living', 'been live'],
    correctAnswer: 'lived',
    english: 'He has lived in Japan for ten years.',
    explanation: '現在完了の継続用法「has + 過去分詞（lived）+ for 期間」です。',
    audioPrompt: 'He has lived in Japan for ten years.'
  }
];

export const DEFAULT_MODIFIERS: Modifier[] = [
  {
    id: 'challengeMode',
    name: 'チャレンジ問題',
    description: '関係代名詞・現在完了・受動態などの難問が出現',
    icon: '👑',
    bonusPercent: 50,
    active: false,
  },
  {
    id: 'difficultyUp',
    name: '難易度UP',
    description: '英検4級の熟語や疑問文・比較級を中心に出題',
    icon: '🧠',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'longerSentences',
    name: '文を伸ばす',
    description: 'より長い複文や長めの語順問題が出現',
    icon: '📜',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'timeLimit',
    name: 'タイムリミット',
    description: '各問題に15秒の制限時間がつきます',
    icon: '⏱️',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'hardcore',
    name: '一撃KO (ノーミス)',
    description: 'ライフが1になり、1問でもミスすると即終了',
    icon: '🔥',
    bonusPercent: 30,
    active: false,
  },
];
