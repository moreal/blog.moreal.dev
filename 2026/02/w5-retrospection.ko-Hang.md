---
published: 2026-02-02T20:45:12+09:00
---

2026 W5 회고
============

2026 W5, 2026년 1월 26일 부터 2026년 2월 1일 까지에 대한 회고입니다.

지난 회고를 작성할 때 목차를 나열하고 시작하는 것이 좋았으므로 나열하고
시작하자면 아래와 같습니다.

 -  있었던 일
 -  좋았던 점
 -  아쉬운 점
 -  개선할 점
 -  W6 목표 정해보기


있었던 일
---------

[Fedify] 쪽에 어쩌다보니 기여를 하게되었습니다. [ap-thread-reader]를 만들면서
발견한 오타와 `traverseCollection` 함수의 버그를 수정하였습니다. 외에 CI가
Flaky하여 살펴보다가 빌드 과정과 CI 실행 과정을 개선하였습니다. 이 과정을
통해서 모노레포 도구가 왜 필요한 건지 이해할 수 있었고, 이를 제안하는 이슈도
올렸습니다. 그리고 실제로 적용하는 PR도 준비하는 중입니다.

관련한 PR 및 이슈들은 아래와 같습니다.

 -  [Fix kvCache JSDoc to reference KvStore instead of Deno.Kv #537]
 -  [Avoid to repeat unnecessary build #543]
 -  [Exclude non-essential files from JSR publishing #545]
 -  [Fix several JSDoc typos and incorrect references #539]
 -  [Fix vocab-tools generateCloner bug #541]
 -  [Clean up CI #546]
 -  [Fix traverseCollection() for inline CollectionPage without id #550]
 -  [Suggestion: migrate to monorepo tooling #547]

   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

앞서 말한 [ap-thread-reader]는 초기에 성능이 굉장히 느렸습니다. 스레드를
가져오는데 50초가량 걸렸었는데 지금은 10초 정도만 소요합니다. 원래 50초는
너무나 오래걸려서 Rosettalens 측에서 타임아웃으로 취급하여 읽을 수가 없었는데
이제는 읽을 수 있습니다. 정확히는 30초 정도 걸릴때 부터 읽을 수 있었습니다.
그 글은 [현대 CPU 버그는 왜 이렇게 흔해졌을까] 라는 글입니다.

`node --perf` 를 이용하여 어디서 가장 오래 걸리는지 파악하며 보았습니다. 측정
결과에서는 socket 관련해서 시간이 많이 걸린다고 나왔고, 세션 재활용 같은
기본적인 최적화를 적용하였음에도 그저 대기시간이 가장 길었으므로 실제로 HTTP
요청을 적게 보내도록 하는 것이 중요했습니다. 룩업을 할 때 Fedify
`documentLoader` 단위에서 캐싱을 할 수 있어 캐싱하도록 하였고, 이것으로 10초
정도 개선되었습니다.

그리고 `traverseCollection` 에서 버그가 있어 이미 댓글을 포함하여 응답을 주고
있음에도 없다고 잘못 판단하고 다시 요청하고 있었는데, 이를 해결하니 꽤 많이
빨라졌습니다. 이 버그를 고친 것이
[Fix traverseCollection() for inline CollectionPage without id #550] PR입니다.

   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

[bencodex-rs] 의 개선도 좀 더 진행했습니다.

prefix length를 읽는 것과 number를 읽는 것이 실제로는 동일하게 ascii 숫자를
읽는 것이라 로직을 공용으로 사용했었는데, number는 BigInt여야 하는 탓에
length를 읽을 때도 BigInt를 사용하는데서 오는 오버헤드가 있었습니다. 이를
제거하니 디코딩에서 25% 이상의 성능 개선이 있었습니다.
<https://github.com/moreal/bencodex-rs/pull/36>

기존에는 `Encode::encode` 함수가 `self` 를 받도록 되어있었는데 이 과정에서
불필요한 복사가 계속 있었고 `&self` 로 바꾸고서 데이터에 따라 다르지만 인코딩
쪽에서 최대 3.5배, 최소 1.55배 빨라졌습니다. Copy-on-Write 도 적용해서 owned
방식보다 최대 1.56배 정도 빠른 `decode_borrowed` 함수를 추가로 제공하였습니다.
<https://github.com/moreal/bencodex-rs/pull/40>

외에도 몇 가지 타당한 개선을 했지만 성능 향상이 있지는 않았습니다.

 -  [Skip redundant UTF-8 validation in read\_number #37]
 -  [Remove redundant `sorted_by()` on BTreeMap encoding #39]

   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

개발적인 면 외에는 글들을 읽었습니다. 그 중 “모든 프로그래머가 알아야 할
메모리 이야기” 시리즈는 정말 유익했습니다. 혹여 안 보신 분들이 계시다면
추천하고 싶습니다. 예전에 이런 것들을 더 잘 알았더라면 이렇게 코드를 짰을텐데
하는 생각이 들었습니다.

외에
“[CppCon 2017: Carl Cook “When a Microsecond Is an Eternity: High Performance Trading Systems in C++”]“
라는 영상도 보았습니다.

Cap'n Proto 도 약간 살펴보았습니다.

[Fedify]: https://github.com/fedify-dev/fedify
[ap-thread-reader]: https://github.com/moreal/ap-thread-reader
[Fix kvCache JSDoc to reference KvStore instead of Deno.Kv #537]: https://github.com/fedify-dev/fedify/pull/537
[Avoid to repeat unnecessary build #543]: https://github.com/fedify-dev/fedify/pull/543
[Exclude non-essential files from JSR publishing #545]: https://github.com/fedify-dev/fedify/pull/545
[Fix several JSDoc typos and incorrect references #539]: https://github.com/fedify-dev/fedify/pull/539
[Fix vocab-tools generateCloner bug #541]: https://github.com/fedify-dev/fedify/pull/541
[Clean up CI #546]: https://github.com/fedify-dev/fedify/pull/546
[Fix traverseCollection() for inline CollectionPage without id #550]: https://github.com/fedify-dev/fedify/pull/550
[Suggestion: migrate to monorepo tooling #547]: https://github.com/fedify-dev/fedify/issues/547
[현대 CPU 버그는 왜 이렇게 흔해졌을까]: https://rosettalens.com/s/ko/why-modern-cpu-bugs-are-so-common
[bencodex-rs]: https://github.com/moreal/bencodex-rs
[Skip redundant UTF-8 validation in read\_number #37]: https://github.com/moreal/bencodex-rs/pull/37
[Remove redundant `sorted_by()` on BTreeMap encoding #39]: https://github.com/moreal/bencodex-rs/pull/39
[CppCon 2017: Carl Cook “When a Microsecond Is an Eternity: High Performance Trading Systems in C++”]: https://www.youtube.com/watch?v=NH1Tta7purM


좋았던 점
---------

[ap-thread-reader] 작업에서 역시나 좋았던 점은 CLI 스크립트를 만들고 이를
바탕으로 테스트하며 빠른 피드백을 돌았다는 점입니다. 웹 어플리케이션이지만
도메인 로직은 동일하고 표현 계층만 다른 것이므로 CLI 스크립트를 만들어 피드백을
더 빠르고 쉽게 얻을 수 있는 것이 좋았던 것 같습니다.

[ap-thread-reader]와 [bencodex-rs] 같은 개인 프로젝트들에서 성능 개선을 해본
것이 좋았습니다. [Fedify]에도 버그 수정 및 CI 소요 시간 개선을 할 수 있어서
좋았습니다.

무엇보다 “모든 프로그래머가 알아야 할 메모리 이야기” 시리즈가 너무 재밌었습니다.


아쉬운 점
---------

지난 주 회고에서 정한 점을 모두 완수하지 못 했습니다. [RustPython] PR은 조금
닫았고 BotKit은 오늘 보고 있었고, 나머지는 보지 못 했습니다. 이력서 업데이트 및
지원도 진행하지 못 했고, 글도 작성하지 못 했습니다. 이것들을 최우선으로 보기로
했으나 옆길로 빠져 수행하지 못 한 것이 너무나 아쉽습니다.

[Fedify] 기여는 [ap-thread-reader] 구현에서 기인한 것이고 얼추 마무리 되었기에
Moonrepo 적용외에는 더 볼 일이 없겠으나, [bencodex-rs] 개선은 순전히 옆길로 샌
것이기에 좀 더 잘 절제해야겠습니다.

코딩 에이전트의 도움을 받기에 코드 작성 같은 부분에서는 타이핑이 거의 없고,
테스트 케이스를 잘 작성하는 등의 일은 원래해야 하는 일이므로 크게 신경쓰이지
않지만 pull request에 설명을 잘 쓰는 것은 또 다른 이야기인 것 같습니다. 이
부분을 좀 더 개선할 부분이 있을지 생각해봄직합니다.

[RustPython]: https://github.com/RustPython/RustPython


개선할 점
---------

W5에 있던 일 중 개선할 점은 명확한 것 같습니다. 좀 더 계획대로 하루가
진행되도록 스스로를 잘 매니징하는 것입니다.

회사에서 일할 때를 생각해보면 전체적인 기한이 있고 이를 카드로 잘게 나누고
주간미팅에서 카드들을 가져간 다음 계속 보드를 보면서 카드를 처리했습니다.
그래서 만약 카드가 잘 진행되지 않는 다면 막혀있는 부분이 있어 방향성을
재검토해야하거나, 도움을 받아야 하는 상황이거나 너무 큰 덩어리라서 잘 완료되지
않는 문제였습니다.

지난 주 목표 중 “CS:APP 책 읽기”, “전체 HFT 구현해보기”, “이력서 업데이트해서
생각해둔 곳들 지원하기” 는 모두 굉장히 큰 덩어리 입니다. 이들은 작업 카드가
아닌 목표이므로 잘개 쪼개져 있을 필요는 없으나, 제가 작업을 할 때 볼 보드가
하나 필요하겠다는 생각이 들었습니다. 예컨대 “이력서 업데이트하기”, “이력서
퇴고하기”, “A사 지원하기”, “B사 지원하기” 등의 작은 카드로 쪼갤 수 있습니다.

이 회고 글을 쓴 뒤 바로 Notion에 프로젝트 보드를 만들고 카드들로 채워
넣어야겠습니다.


W6 목표 정해보기
----------------

지난 주와 큰 목표는 동일하게 충동적이지 않게 계획적으로 일을 수행하기입니다. 위
“개선할 점” 부분에서 말했듯이 보드를 만들어 관리해야 합니다.

 -  W6 목표 별로 작은 카드들을 만들어 보드로 관리하고 이 보드를 기반으로 작업하기
 -  오픈소스 PR 정리하기
     -  <https://github.com/fedify-dev/botkit/pull/17>
     -  <https://github.com/dahlia/hongdown/pull/17>
     -  <https://github.com/RustPython/RustPython/pull/6799>
     -  <https://github.com/python/cpython/pull/137805>
 -  Rust로 HFT 구현하기
 -  CS:APP 책 읽기

지난주에 비해 목표 항목을 줄였습니다. 이력서 관련 작업은 이것들을 모두 수행한
후 진행해야 합니다.
