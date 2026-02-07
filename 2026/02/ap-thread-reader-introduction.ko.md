---
published: 2026-02-06T23:40:38+09:00
description: ap-thread-reader의 기능을 소개합니다.
---

ap-thread-reader, ActivityPub-compatible Thread Reader
======================================================

저는 이미 *ap-thread-reader*와 관련된 글을 작성했었고 이 글은 기능에 대해
설명하는데 집중되어 있습니다[^1].

   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

ap-thread-reader는 글자 수 제한 등으로 인해 답글 형식으로 긴 글을 적은 것을 한
페이지에서 볼 수 있도록 도와주는 프로그램입니다.

이 글을 쓰는 시점에서 <https://ap-thread-reader.fly.dev> 로 접속하실 수
있습니다. 기본적으로 아래와 같은 페이지에서 시작합니다.

![](./start-page.png)

텍스트 박스에 읽고 싶은 스레드의 첫 글의 링크를 입력하면 스레드를 보여주는
페이지로 넘어갑니다. 혹은 `https://ap-thread-reader.fly.dev/read?url=<url>`
꼴로 URL을 직접 입력하여 넘어갈 수 있습니다. 이렇게 쿼리 파라미터로 값을 넣을
수 있으면 Firefox 등에서 shortcut으로 설정할 때 매우 유용합니다.

예제로 로컬호스트에서 띄운 Note 링크를 입력해 보았습니다. 그러면 아래처럼 3개의
글이 연달아 나오게 됩니다.

![](./multi-content-lang-en-select.png)

그런데 저자 및 작성 시간 위에 *Content Language* 와 *en*,
*ja*, *ko* 같은 것이 보입니다. 이는 ActivityPub Object에서 제공하는
`contentMap` 을 활용한 것입니다. 만약 `contentMap` 을 활용하여 다국어를
제공하고 있다면 이를 반영하여 보여줍니다. *ko*를 선택해보면 아래와 같이 보이게
됩니다. URL 쿼리 파라미터 `language` 로 이를 명시해줄 수 있습니다 (e.g.,
`https://ap-thread-reader.fly.dev/read?url=<url>&language=ko`). 그리고 만약
`contentMap` 을 제공해주고 있지 않다면 *Content Language* 선택 UI는 표시되지
않습니다.

![](./multi-content-lang-ko-select.png)

그리고 기본적으로 클라이언트에서 우선 렌더링하여 로딩 애니메이션을 보여주다가
스레드가 모두 불러와지면 한 번에 렌더링하도록 되어있습니다. 이 방식은 페이지를
별도 번역 프로그램 등으로 넘길 때 불편합니다. 때문에 스레드가 모두 불러와졌을때
온전히 렌더링된 결과가 오도록 `ssr` URL 쿼리 파라미터를 제공합니다 (e.g.,
`https://ap-thread-reader.fly.dev/read?url=<url>&ssr=true`)

   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Note: ap-thread-reader는 AGPL-3.0 라이센스를 따르며
<https://github.com/moreal/ap-thread-reader> 에서 소스코드를 확인할 수 있습니다.

[^1]: <https://blog.moreal.dev/2026/02/ap-thread-reader/>
