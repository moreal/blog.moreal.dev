---
published: 2025-03-30T00:00:00+09:00
---

Fedify CLI로 Content Warnings 이해하기
=================================

서문 (동기)
-------

Mastodon에서 글을 쓸 때 Content Warnings을 자주 쓰는데:

1.  내가 쓰는 글이 어떤 사람에게는 기분 상할 글일 수도
    있을까 하는 걱정도 있고,
2.  혼자 말을 자주 적는데 소음같이 느껴져서 보고 싶지 않을
    사람도 있을까 싶어서 "혼자 말" 같은 경고문을 달고
    적어놓는다.

요즘은 "혼자 말" 대신 요약을 좀 적어놓는 편인 것 같다.
그런데 Mastodon에서 글을 적으면 몇 글자 더 적을 수 있는지,
글자 수 제한을 표시해준다. Content Warnings을 적는데도 글자
수 제한이 줄어드는 것을 보고 본문과 Content Warnings가 같은
필드에 있는 걸까 그런 궁금증이 들었다. 어떻게 생겼는지
보고 글을 적고 있는 지금 다시 생각하면, 조금 잘못된(?)
상상이었던 것 같지만 암튼 그랬다.


본문
--

### Activity 객체 읽어오기

내가 적은 글의 Activity 객체 버전을 확인해보려면 어떻게
해야 하지 싶던 중, @hongminhee@hackers.pub 님이 만드신
[Fedify]에서 제공하는 CLI 도구에 관련 기능이 있었던 것 같아
살펴보니 [`fedify lookup`][fedify-docs-lookup]이라는 명령어가
있었다.

사용법은 아래와 같이 인자로 글 URL을 넘겨주면 됐다.

~~~~
fedify lookup https://social.silicon.moe/@moreal/114252336335817713
~~~~

그러면 아래와 같이 Activity 객체 내용을 보여준다:

~~~~
$ fedify lookup https://social.silicon.moe/@moreal/114252336335817713
✔ Fetched object: https://social.silicon.moe/@moreal/114252336335817713.
Note {
  id: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713",
  attribution: URL "https://social.silicon.moe/users/moreal",
  contents: [ "<p>본문</p>", <ko> "<p>본문</p>" ],
  published: 2025-03-30T16:31:40Z,
  replies: Collection {
    id: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713/replies",
    first: CollectionPage {
      partOf: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713/replies",
      next: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713/replies?only_other_accounts=true&page=true"
    }
  },
  shares: Collection {
    id: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713/shares",
    totalItems: 0
  },
  likes: Collection {
    id: URL "https://social.silicon.moe/users/moreal/statuses/114252336335817713/likes",
    totalItems: 0
  },
  summary: "Content Warning 테스트",
  url: URL "https://social.silicon.moe/@moreal/114252336335817713",
  to: URL "https://social.silicon.moe/users/moreal/followers",
  cc: URL "https://www.w3.org/ns/activitystreams#Public",
  sensitive: true
}
✔ Successfully fetched the object.
~~~~

[Fedify]: https://fedify.dev
[fedify-docs-lookup]: https://fedify.dev/cli#fedify-lookup-looking-up-an-activitypub-object

### Activity 객체 이해하기

"Content Warnings"에 넣었던 `Content Warning 테스트`라는 문구는
`summary` 필드에 들어있었다.

`summary` 필드에 대해 살펴보기 위해서
[ActivityPub 문서][w3-ap]에 들어갔다. `"Note"`를 키워드로
검색해보니 아래 같은 예제를 발견했다:

~~~~ json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Note",
  "to": ["https://chatty.example/ben/"],
  "attributedTo": "https://social.example/alyssa/",
  "content": "Say, did you finish reading that book I lent you?"
}
~~~~

예전에 Fedify에 기여할 때 기억으로는 Activity가 [JSON-LD]
포맷으로 표현되므로 스키마를 확인하고자 `@context` 필드의
링크로 들어갔다. 그렇게 타고 들어가서 [Note의 정의]를
발견했는데 [Object]를 상속하였고, 상속받은 것 외에
자신만의 필드는 없어 보였다.

링크를 또 타고 들어가
[summary의 정의]를
볼 수 있었다. 설명은 아래와 같다:

~~~~
A natural language summarization of the object encoded as HTML. Multiple language tagged summaries MAY be provided.
~~~~

HTML로 스타일링할 수도 있고, 여러 언어별로 요약을 제공할
수도 있다고 한다. 아래 JSON은 문서에 있는 예제인데,
영어(en)와 스페인어(es), 중국어 간체(zh-Hans) 언어마다
요약을 각각 제공하는 것으로 보인다.

~~~~ json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "name": "Cane Sugar Processing",
  "type": "Note",
  "summaryMap": {
    "en": "A simple <em>note</em>",
    "es": "Una <em>nota</em> sencilla",
    "zh-Hans": "一段<em>简单的</em>笔记"
  }
}
~~~~

[w3-ap]: https://www.w3.org/TR/activitypub/
[JSON-LD]: https://json-ld.org/
[Note의 정의]: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
[Object]: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
[summary의 정의]: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-summary


결론
--

 -  ~~`Content Warnings`에 요약을 적는 건 적절한 용례이다! (?)~~
     -  +) Hackers' Pub에서
        [댓글]로
        달아주셔서 알게된 놓친 부분인데, `Content Warnings`를
        쓰면 [`as:sensitive`] 확장 속성도 같이 추가되어서
        Mastodon에서 `Content Warnings`를 요약으로 쓰는 것이 마냥
        맞는 용례는 아닌 것 같다.
 -  사용자가 주로 사용하는 언어로 작성하면, 애플리케이션
    단에서 다른 요약들도 번역해서 자동으로 채워줄 수도
    있겠다. (읽는 쪽에서 번역하는 게 나으려나)

[댓글]: https://hackers.pub/@hongminhee/0195e9b8-8824-7461-85e8-346664f4fa2a
[`as:sensitive`]: https://docs.joinmastodon.org/spec/activitypub/#sensitive
