---
layout: post
title: "How to Put Papers on ArXiv"
categories: "2019"
tags: other how-to
description: "I was recently trying to put my research paper draft on ArXiv. I thought it would be as simple as submitting the pdf file, which should take approximately less than ten minutes. I was wrong. It took several hours to figure what was going on. I included some tips here to prevent mistakes I made from happening again."
comments: true
---
I was recently trying to put my research paper draft on ArXiv. I thought it would be as simple as submitting the pdf file, which should take approximately less than ten minutes. I was wrong. It took several hours to figure what was going on. I included some tips here to prevent mistakes I made from happening again.
<!--description-->

The first mistake I made was assuming a single submission of pdf file would be sufficient. ArXiv apparently has mechanisms detecting whether the sumitted pdf file is generated using Tex/Latex. According to ArXiv:

> a PDF file created from a TeX/LaTeX file will be rejected. There are [good reasons](https://arxiv.org/help/faq/whytex) why arXiv insists on TeX/LaTeX source if it is available. arXiv produces PDF automatically from all TeX submitted source. For information on viewing the PDF provided by arXiv, see our PDF browsing help.

So, the first thing I came up with was to somehow make the pdf appearring "anonymous" to ArXiv. The were several methods but none of them appear to be practical. If you are interested there is a [link](https://tex.stackexchange.com/questions/95080/making-an-anonymous-pdf-file-using-pdflatex/95109) to some methods that might be useful. [pdfprivacy](https://ctan.org/pkg/pdfprivacy) is  package used to remove or suppress pdf meta-data and it sounds promising but I haven't yet tryied.

So the only option left was to follow the restriction described. It was confusing at the beginning because the everything worked like a charm on Overleaf but it completely fell apart when I tried to compile the sources locally. I was under the impression that if it worked on Overleaf i should work everywhere else, which cause many hours of searching for potential problems related to local environment.

After hours of frustration, it started to appear that there was nothing wrong with my local environment. The pdf produced by Overleaf was only "appearing" correct. There were several syntax issue in my .bib file, mostly caused by careless copy-and-paste and duplicate records. Overleaf simple surpressed some of those errors, which leads me to think everything was fine.

There were also error messages popping up during compilation. Most of them are related to undefined references. Something like:

`Warning--empty journal in article`

The problem was that bibliographic information obtained from Google Scholar night include serious mistakes. Thwarning message was telling that entries of type @article require a non-empty journal field. For example, the entry could look like:

```
@article{article,  
  title={Something Cool},  
  author={Somebody},
  year={2019},
  publisher={IET}
}
```

The four required fields for entries of type @article are author, title, journal, and year. This is why the warning message showed up. But it doens't really affect the compilation on ArXiv.

When I finally compiled all sources locally with success, I imeediately moved all source on ArXiv hoping it would finally work. It didn't.

`! LaTeX Error: File 'shoc.pdf' not found.`

I had no idea why this occured. All sources I used to compile were uploaded to ArXiv so there were no reasons for it to fail. More surprisingly, the references only failed for my .eps files but not .png files. According to ArXiv there are several [reasons](https://arxiv.org/help/faq/psbad) why PostScript (PS/EPS) figures might fail on ArXiv. Due to the error message, it appears the system is trying to find a file called *shoc.pdf* to insert into the main pdf but somehow couldn't locate the file.

The solution was to upload the pdf files produced locally to ArXiv. However, the locally generated files have slightly different name. All files names are modified to "name-eps-convert-to.pdf". What a hassle!

Overall, uploading to ArXiv was not the most pleasant experience. Latex's compilcation system is the one to blame.
