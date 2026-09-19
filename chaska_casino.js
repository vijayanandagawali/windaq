$('.left,.right,.showall').click(function () {

    var category = $("h2#game_category_").html();
    $.ajax({
        url: "/live-casino",
        dataType: "json",
        async: true,
        success: function (res) {

        },
        error: function (res) {},
    });
});

$(document).ready(function () {

    //get all selected category provider
    function getprovider() {

        let category = $('.ck-casinoFilters li.ck-active').data('category-name');
        let categoryId = $('.ck-casinoFilters li.ck-active').data('category');

        $.ajax({
            type: "GET",
            url: '/categoryProvider',
            data: {
                "category": category,
                "categoryId": categoryId,
            },
            success: function (response) {

                $(".providers").remove();

                var providerList = $('.ck-providerFilter ul');
                providerList.empty();
                providerList.off('click').on('click', 'li', function () {
                    let $this = $(this);
                    let provider = $this.data('provider');

                    if (provider === 'all') {
                        // Toggle "All Providers"
                        if ($this.hasClass('ck-active')) {
                            // Remove ck-active from all provider buttons
                            $('.ck-providerFilter ul li').removeClass('ck-active');
                        } else {
                            // Add ck-active to all provider buttons
                            $('.ck-providerFilter ul li').addClass('ck-active');
                        }
                    } else {
                        // Toggle individual provider
                        $this.toggleClass('ck-active');

                        // Remove ck-active from "All Providers" if any individual is selected
                        if ($('.ck-providerFilter ul li[data-provider!="all"].ck-active').length > 0) {
                            $('.ck-providerFilter ul li[data-provider="all"]').removeClass('ck-active');
                        }
                    }
                    search();
                });

                providerList.append(`
                    <li class="providers" data-provider="all">
                        All Providers
                    </li>
                `);

                $.each(response.data, function (i, item) {
                    providerList.append(`
                        <li class="providers" data-provider="${item.name}">
                            ${item.name}
                        </li>
                    `);
                });
            }
        });
    }


    function search() {

        let searchGame = $('#search').val();

        let category = $('.ck-casinoFilters li.ck-active').data('category-name');
        if (category === 'other') category = '';

        let url = window.location.href;
        let parts = url.split("/");

        // let provider = $('.ck-providerFilter ul li.ck-active').data('provider');
        // Now collect all active providers and call search
        let provider = [];
        $('.ck-providerFilter ul li.ck-active').each(function () {
            provider.push($(this).data('provider'));
        });

        $.ajax({
            type: "GET",
            url: '/backendGameSearch',
            beforeSend: function () {
                $("#load_screen").hide();
            },
            data: {
                "search": searchGame,
                "provider": provider,
                "category": category,
                "page": parts[3],
            },
            success: function (response) {

                $('.ck-gameSection').remove();

                if (response) {
                    $(response).insertAfter('.ck-casinoFilterNav');
                }
            }
        });
    }

    let moengageTimeout;
    $(document).on('input', '#search' ,function () {
        clearTimeout(moengageTimeout);
        if (this.value.length > 0) {
            search();
            
            moengageTimeout = setTimeout(function () {
                moengageGameSearchEvent(); // Trigger MoEngage event after delay
            }, 1500); // Wait 1.5 seconds of inactivity
        } else {
            search();
        }

    });

    function moengageGameSearchEvent() {
        const searchTerm = $('#search').val();

        if (searchTerm.length > 0 && typeof Moengage !== 'undefined') {
            var dt = new Date();
            var time = dt.getDate()+"-"+(dt.getMonth() + 1)+"-"+dt.getFullYear()+" "+dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
            Moengage.track_event('Game Searched', {
                "Keyword": searchTerm,
                "userID":localStorage.getItem('user-id'),
                "Platform":"Web",
                "Time" : time
            });
        }
    }

    $(document).ready(function () {
        $('.ck-providerFilter ul li').on('click', function () {
            let $this = $(this);
            let provider = $this.data('provider');

            if (provider === 'all') {
                // Toggle "All Providers"
                if ($this.hasClass('ck-active')) {
                    // Remove ck-active from all provider buttons
                    $('.ck-providerFilter ul li').removeClass('ck-active');
                } else {
                    // Add ck-active to all provider buttons
                    $('.ck-providerFilter ul li').addClass('ck-active');
                }
            } else {
                // Toggle individual provider
                $this.toggleClass('ck-active');

                // Remove ck-active from "All Providers" if any individual is selected
                if ($('.ck-providerFilter ul li[data-provider!="all"].ck-active').length > 0) {
                    $('.ck-providerFilter ul li[data-provider="all"]').removeClass('ck-active');
                }
            }
            search();
        });
    });

    $('.ck-casinoFilters li').on('click', function () {

        $('.ck-casinoFilters li').removeClass('ck-active');
        $(this).addClass('ck-active');

        getprovider();  
        search();
    });

    let searchTimeout = null;

    $(document).on('input', '#search-all', function () {
        const value = $(this).val().trim();

        // clear previous timer
        clearTimeout(searchTimeout);

        // minimum 3 characters required
        if(value.length === 0){
            searchNew(1);
        }else if (value.length < 3) {
            return;
        }

        // debounce: wait 300ms after typing stops
        searchTimeout = setTimeout(() => {
            searchNew(1);
        }, 300);
    });

    function searchNew(pageNo = 1) {
        var searchgame = $('#search-all').val();
        var url = window.location.href;
        var parts = url.split("/");

        let category = $('#game_category').data('cat') || '';
        let pageCat = parts[3] || ''; // Extracting the category from URL

        var provider = [];
        $(".selectprovider").each(function () {
            if ($(this).is(":checked")) {
                provider.push($(this).val());
            }
        });

        $.ajax({
            type: "GET",
            url: '/backendGameSearchNew',
            beforeSend: function () {
                // $("#load_screen").hide();
            },
            data: {
                "search": searchgame,
                "provider": provider,
                "category": category,
                "pageCat": pageCat,  // From URL path
                "pageNo": pageNo,    // Passed dynamically for pagination
            },
            success: function (response) {
                // Convert response string to jQuery object
                const $responseHtml = $(response);

                // Extract ONLY ck-gamesBox inner content
                const gamesHtml = $responseHtml.find('.ck-gamesBox').html();
                // $('.ck-allGames-box').remove();
                $('.ck-allGames-box').empty()
                if (gamesHtml) {
                    // $(response).insertAfter('.ck-casinoFilterNav');
                    $('.ck-allGames-box').html(gamesHtml);
                }
            }
        });
    }


    $(document).on("click", ".paginationContainer a", function (e) {
        e.preventDefault(); // Prevent default link behavior

        let pageNo = $(this).attr("href").split("page=")[1]; // Extract page number
        searchNew(pageNo); // Call search with new page number
    });

    $("#list").each(function () {
        $(this).find('li').first().addClass("activeLinkBorder");
    });

    $(document).on("click", "#uncheckall" ,function () {
        $("input:checkbox").prop('checked', false);
        search();
    });

    $(document).on('click','#checkall',function () {
        $("input[type=checkbox]").prop("checked", $(this).prop("checked"));
    });

    $(document).on('click','.selectprovider',function () {
        if (!$(this).prop("checked")) {
            $("#checkall").prop("checked", false);
        }
    });
});