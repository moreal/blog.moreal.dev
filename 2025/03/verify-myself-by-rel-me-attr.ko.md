---
published: 2025-03-19T00:00:00+09:00
---

Hackers' Pub에서 HTML rel 속성으로 자기 인증하는 원리
=============================================

## 서문 (동기)

아래와 같은 Hackers' Pub 글을 보았습니다:

> 이제 프로필의 링크에 인증 여부가 보이게 됩니다. 링크를 인증하기 위해서는,
> 링크된 페이지 측에서도 Hackers' Pub 프로필을 rel="me" 속성과 함께 링크해야
> 합니다. Mastodon이나 GitHub 같은 경우 프로필에 링크를 추가하면 rel="me" 속성이
> 추가되게 되어 있으니, Mastodon이나 GitHub 프로필 링크를 추가하면 인증은
> 자동으로 될 겁니다. 개인 웹사이트가 있으신 분들은 Hackers' Pub 프로필을
> rel="me" 속성과 함께 링크하면 인증이 됩니다.
>
> 참고로 인증은 프로필 설정을 저장할 때 이뤄집니다. 이미 Mastodon이나 GitHub
> 프로필을 링크해 두신 분들은 인증 표시가 안 뜰 수도 있는데, 그럼 프로필 설정에
> 들어가셔서 저장 버튼을 한 번 눌러주시면 인증 버튼이 붙을 겁니다.
>
> from https://hackers.pub/@hongminhee/0195ad00-50db-7bb1-b0a0-edaf9ce73515

그래서 Hackers' Pub 설정으로 들어가서 GitHub 링크를 추가하고 저장버튼을
눌러봤지만 체크 표시가 나타나지 않았습니다. `rel="me"`가 뭔지 잘 몰라서
`https://github.com/moreal?rel=me` 같이 추가해봤는데 이것도 아니라서 (~~아닐 것
같았지만~~) 찾아본 내용을 가볍게 메모로 남깁니다.

## 본문

`rel="me"`를 검색하니 MDN 문서가 반겨주었습니다. HTML
`<link rel="stylesheet" ...` 할 때 `rel` 속성이었습니다. `<link rel="me"` 혹은
`<a rel="me"` 같은 느낌으로 사용할 수 있는 것 같았습니다.

<https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/me>

GitHub 프로필 설정에서 `https://hackers.pub/@moreal` 소셜 링크를 추가하면
아래처럼 링크 `a` 요소에 `rel="me"` 속성을 추가하여 줍니다.

```html
<a
  rel="nofollow me"
  class="Link--primary wb-break-all"
  href="https://hackers.pub/@moreal"
>https://hackers.pub/@moreal</a>
```

이 값을 활용하여 인증 마크를 표시하는 것으로 보입니다.
([Hackers' Pub 링크 인증 소스코드](https://github.com/dahlia/hackerspub/blob/76dba1fbddd7c8a9ec86a5609d49df9c0de9efb9/models/account.ts#L224-L247))

## 결론

GitHub 등에서 `https://hackers.pub/@<id>` 를 연관 링크로 추가하고 Hackers' Pub
프로필 설정에서 다시 저장 버튼을 누르면 체크 표시가 나타납니다!

## 여담

함께 `rel` 속성에 달려있는 `nofollow` 같은 값은 검색엔진에게 주는 힌트처럼
보입니다. 해당 링크와 연관이 있음을 보장하지 않음, 같은 의미 같습니다. 일단 지금
하려던것과 무관하니 더 찾아보지는 않았습니다.

https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel#nofollow

그리고 Hackers' Pub이 오픈소스라서 실제로 어떻게 인증마크를 표시하는지 확인할
수도 있었습니다!
