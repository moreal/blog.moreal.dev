---
published: 2026-02-05T22:53:11+09:00
---

ap-thread-reader 기록
=====================

요즘은 hongdown 덕분에 Hashnode 같은 별도의 에디터 없이 Zed에서 마크다운 문서를
쓰는게 즐겁습니다. 때문에 지금도 글을 쓰기 시작합니다.


배경
----

예전에 [Hackers' Pub]을 보다가 최근에
[왜 CPU에 버그가 많아졌는지에 대한 글][hayline-post]을 발견했습니다. 이는
Mastodon를 사용하시는 유저분이 쓰신 글이었고, Mastodon의 글자 수 제한 정책으로
인해 Twitter에서 처럼 단문에 답글을 이어 다는 방식으로 글을 쓰셨습니다. 그리고
저는 최근 글을 읽을 때 거의 [Rosettalens]로 번역해서 읽고 있어서, 이 글도
Rosettalens에 넘겼는데 당연하게도 이 글의 답글만 나오지도 않고 스레드 전체의
답글이 잘 나오지도 않았습니다. 그래서 *ActivityPub thread reader* 같은 키워드로
검색했던가, 정확히 기억은 나지 않는데 보이지 않아서 Fedify를 활용하여 간단히
작성해보기로 했습니다.

(후술하겠지만 Mastodon 스레드를 한 페이지에서 읽을 수 있는 도구가 있었습니다.)

[Hackers' Pub]: https://hackers.pub
[hayline-post]: https://hackers.pub/@hyaline/019be77f-1a92-7f48-84a1-c446fb121373
[Rosettalens]: https://rosettalens.com/


개발기
------

Claude Code에게 많이 일임했는데 그래도 첫 시작 프롬프트를 그나마 꽤 길게
썼습니다. 도메인 로직에 대해서 꽤 상세한 설명을 썼고, 개발 순서에 대해서는
테스트를 먼저 작성해야 하며 그 다음에는 CLI 앱을 작성해서 루프를 돌고 정상
동작을 확인한 후 프론트엔드 구현으로 넘어가야 한다고 적었습니다. CLI 앱을
만들어서 돌게 하니 알아서 피드백 루프를 돌게하는데 참 유용하였습니다.

그렇게 처음 나온 결과물에서 스레드를 읽어오는데 50초 가량이나 걸려서 관련
최적화를 하는데 시간을 들였습니다.

우선 `node --perf` 로 프로파일링 결과를 보기로 했는데 애초에 네트워크 대기
시간이 길었고 크게 유용하지 않았습니다. TCP 연결 재활용(undici) 및
`DocumentLoader` 캐시를 넣었음에도 30초 정도로 여전히 오래걸려서 문제였습니다.
그래서 실제로 어디에 request들을 보내는 지 알아야 했는데 이는 Fedify에서 이미
디버그 레벨로 로깅해주고 있었고 Fedify는 Logtape을 사용하기 때문에 `fedify`
영역을 활성화해서 관련 로그를 볼 수 있었습니다.

로그에서 보여지는 URL들을 `fedify lookup` 명령어를 활용하여 실제 ActivityPub
객체가 어떻게 오는지 보면서 따라가보는데 `Note.replies.first.items` 필드에
다음 답글을 임베딩해서 주는데도 이를 활용하면 될 것 같았습니다.

~~~~ json
fedify lookup --raw 'https://social.silicon.moe/@moreal/115990520528477317' | jq '.replies'
✔ Fetched object: https://social.silicon.moe/@moreal/115990520528477317.
{
  "id": "https://social.silicon.moe/users/moreal/statuses/115990520528477317/replies",
  "type": "Collection",
  "first": {
    "type": "CollectionPage",
    "next": "https://social.silicon.moe/users/moreal/statuses/115990520528477317/replies?min_id=115990521217861925&page=true",
    "partOf": "https://social.silicon.moe/users/moreal/statuses/115990520528477317/replies",
    "items": [
      "https://social.silicon.moe/users/moreal/statuses/115990521217861925"
    ]
  }
}
✔ Successfully fetched the object.
~~~~

그리고 Fedify에는 `traverseCollection` 이라는 유틸리티 함수가 있어 이를
활용하려고 코드를 수정했지만 컬렉션을 순회하지 않고 아무것도 반환하지
않았습니다. 테스트 케이스나 Fedify 문서를 볼 때 `first.id` 가 없을때도 순회를
도는 것이 맞는 것 같아서 이를 수정하는 PR을 올렸습니다.
<https://github.com/fedify-dev/fedify/pull/550>

Fedify 문서를 읽다가 발견한 오타나 기여하면서 보이는 점들을 개선하는 PR들을
여럿 올렸습니다. 옆길로 빠져서 Fedify 기여에 시간을 더 쓴 것 같은 건 안 비밀
(..)

 -  [Fix kvCache JSDoc to reference KvStore instead of Deno.Kv #537]
 -  [Avoid to repeat unnecessary build #543]
 -  [Exclude non-essential files from JSR publishing #545]
 -  [Fix several JSDoc typos and incorrect references #539]
 -  [Fix vocab-tools generateCloner bug #541]
 -  [Clean up CI #546]
 -  [Fix traverseCollection() for inline CollectionPage without id #550]
 -  [Suggestion: migrate to monorepo tooling #547]
 -  [Correct `workspace:` protocol usage #556]

[Fix kvCache JSDoc to reference KvStore instead of Deno.Kv #537]: https://github.com/fedify-dev/fedify/pull/537
[Avoid to repeat unnecessary build #543]: https://github.com/fedify-dev/fedify/pull/543
[Exclude non-essential files from JSR publishing #545]: https://github.com/fedify-dev/fedify/pull/545
[Fix several JSDoc typos and incorrect references #539]: https://github.com/fedify-dev/fedify/pull/539
[Fix vocab-tools generateCloner bug #541]: https://github.com/fedify-dev/fedify/pull/541
[Clean up CI #546]: https://github.com/fedify-dev/fedify/pull/546
[Fix traverseCollection() for inline CollectionPage without id #550]: https://github.com/fedify-dev/fedify/pull/550
[Suggestion: migrate to monorepo tooling #547]: https://github.com/fedify-dev/fedify/issues/547
[Correct `workspace:` protocol usage #556]: https://github.com/fedify-dev/fedify/pull/556


사용례
------

개발하고 중간 즈음에 다시 검색해보니 Mastodon thread reader는 이미 있었습니다.

[mastoreader.io]와 [mastodon-unroller] 였는데 전자는 SSR이 되지 않아
Rosettalens 같은 외부 서비스에 넘기기 어려웠고 mastodon-unroller의 경우 이 글을
적으며 다시 테스트 해보니 SSR도 지원하고 Rosettalens에 넘길 수 있었습니다.

나중에 위 내용을 알고 나서 조금 기운이 빠졌는데, 그 이유는 보통 글자 수 제한은
Mastodon 만의 문제이기 때문에 주 사용례가 Mastodon이고 mastodon-unroller도
SSR을 지원하지 않는다고 생각했는데 SSR도 지원하기 때문입니다.

굳이 세일즈 포인트를 잡는다면 글자 수 제한이 있는 ActivityPub 호환 플랫폼이라면
어디에서든 사용할 수 있다는 점입니다.

[mastoreader.io]: https://mastoreader.io/
[mastodon-unroller]: https://github.com/zachpmanson/mastodon-unroller


마무리
------

Fedify 처럼 Logtape를 통해 디버그 로그를 제공하면 라이브러리를 사용하는
입장에서 매우 유용했습니다.

사실 테스트를 잘 짜는 것이 가장 좋지만 CLI를 만들어두면 코딩 에이전트의 피드백
루프를 만들기도 수월하고 수동으로 돌려보기도 용이해서 좋았습니다.

이 프로젝트와 Fedify에 시간을 쓰고 다음에는 샛길로 빠지지 말아야겠다
생각했었습니다. 나쁜 감정이라고 보다는 원래 하려던 것에 집중을 잘 하지 못 한
것이 아쉽다는 이야기입니다.

짧은 글이지만 집중해서 1시간 정도 안에 썼다는 것은 긍정적인 것 같습니다.

아, 저장소 링크는 <https://github.com/moreal/ap-thread-reader> 이고
<https://ap-thread-reader.fly.dev/> 에서 사용해보실 수 있습니다.
