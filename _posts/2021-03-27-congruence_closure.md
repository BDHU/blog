---
layout: post
title: "Congruence Closure"
last_modified_at: 27 March, 2021
categories: "2021"
description: "congruence closure algorithm
"
tags: algorithm theory
comments: true
---

This is a summary of how to compute congruence closure.
<!--description-->

## Equivalence Relation

Equivalence relation has three properties: reflexive, symmatric, and transitive.
For example, a binary relation $$R$$ over a set $$S$$ meeting these three properties can be expressed as:

[[ E.g. $$\geq$$ is not an equivalence relation because it break the symmetric property. $$4 \geq 6$$ does not imply that $$6 \geq 4$$::rmn]]  

* Reflexive: $$\forall s \in S.\ sRs$$
* Symmetric : $$\forall s_1, s_2 \in S.\ s_1 R s_2 \rightarrow s_2 R s_1$$
* Transitive: $$\forall s_1, s_2, s_3 \in S.\ s_1 R s_2 \land s_2 R s_3 \rightarrow s_1 Rs_3$$

## Congruence Relation

Given a set $$S$$ equipped with functions $$F = \{f_1, ..., f_n\}$$, a relation $$R$$ over $$S$$ is a congruence relation if $$R$$ is an equivalence relation and for every $$n$$'ary function $$f \in F$$ we have:

[[A counter example would be given $$R(x, y)$$ defined as $$\|x\| = \|y\|$$ on all integers. If we have $$R = \{2, 2\}$$ and $$f(x) = x + 1$$ (successor function), then we know it violates the equivalence relation we mentioned above::lmn]]

\\[\forall \overset{\rightarrow}{s}, \overset{\rightarrow}{t}.\ \bigwedge\limits_{i=1}^{n}s_i R t_i \rightarrow f(\overset{\rightarrow}{s}) R f(\overset{\rightarrow}{t})\\]

## Equivalence Closure

In short, the equivalence closure $$R^E$$ is the smallest equivalence realtion that includes $$R$$.[[$$R^E$$ is a superset of $$R$$::rsn]]
This is illustrated through an example. Given a set $$S = \{a, b, c\}$$ and binary relation $$R:\{\langle a, b \rangle , \langle b, c \rangle, \langle d, d \rangle\}$$, $$R^E$$ would contain all elements extended from $$R$$ based on the three properties of equivlance relation.

## Congruence Closure

Naturally, congruence closure $$R^C$$ would be the smallest set that contains congruence relation $$R$$. What this means is $$R^C$$ contains $$R^E$$ (the equivlance closure we derived before), and any element generated from $$R^E$$ by a given function that produces element which also satisfies equivelance relation. For example, Given $$S = \{a, b, c\}$$ and function $$f$$ such that $$f(a) = b$$, $$f(b) = c$$, $$f(c) = c$$, the congruence closure would contain nine elments in total. First, we
would use the procedure above to generated equivalence closure. Then, because $$f(a) = b$$ and $$f(b) = c$$ due to congruence relation, we know $$b = c$$, now we apply the procure for generating equivalence closure again.