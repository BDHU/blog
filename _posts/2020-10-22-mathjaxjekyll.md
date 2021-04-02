---
layout: post
title: "Add MathJax v3 Support to Jekyll"
last_modified_at: 02 April, 2021
categories: "2020"
description: "I was using Mathjax v2 for a while and I heard v3 perform significantly better than v2. Many great tutorials explains explains how to add Mathjax support to Jekyll websites. Some of them only cover Mathjax v2. So here is the brief summary on how to add Mathjax v3 support to your Jekyll website."
tags: web other how-to
comments: true
---

I was using Mathjax v2 for a while and I heard v3 perform significantly better than v2. Many great tutorials explains explains how to add Mathjax support to Jekyll websites. Some of them only cover Mathjax v2. So here is the brief summary on how to add Mathjax v3 support to your Jekyll website.
<!--description-->

* In the ```_config.yml``` located in your root directory, add this line:
```text
markdown: kramdown
```

* Create a file called ```mathjax.html``` insides ```_includes/```, add these lines (these settings come from the Mathjax [documentaion](https://docs.mathjax.org/en/latest/web/configuration.html).):
```text
<script>
MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']]
  }
  ,svg: {
    fontCache: 'global'
  }
};
</script>
<script
  type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js">
</script>
```

{% raw %}
* Add this line in your ```_includes/head.html``` before ```</head>```:
```text
{% include mathjax.html %}
```
{% endraw %}

* Now you can write in-line math equations in your markdown file like:
```text
\\f(x) = x^2\\)
```
or
```text
$f(x) = x^2$
```
It will be render to:
\\(f(x) = x^2\\)

If you are already using Mathjax v2 and wish to just convert it to v3, you may also try this configuration [converter](https://mathjax.github.io/MathJax-demos-web/convert-configuration/convert-configuration.html). The most useful resource is the official Mathjax [documentation](https://docs.mathjax.org/en/latest/).