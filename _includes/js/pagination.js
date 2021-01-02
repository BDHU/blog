$(".loadMore").click(loadMorePosts);
function loadMorePosts() {
  alert(5+4);
  var _this = this;
  var $blogContainer = $("#blogContainer");
  var nextPage = parseInt($blogContainer.attr("data-page")) + 1;
  var totalPages = parseInt($blogContainer.attr("data-totalPages"));
  $(this).addClass("loading");
  
  $.get("/page" + nextPage, function (data) {
    var htmlData = $.parseHTML(data);
    var $articles = $(htmlData).find("article");
    $blogContainer.attr("data-page", nextPage).append($articles);
    if ($blogContainer.attr("data-totalPages") == nextPage) {
      $(".loadMore").remove();
    }
    $(_this).removeClass("loading");
  });  
}
